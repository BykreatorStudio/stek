import { NextRequest, NextResponse } from 'next/server'
import { admin, initWebpush, fmt, generateInsights, insertAndPush } from '../_utils'

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar']

export async function GET(request: NextRequest) {
  initWebpush()
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const now = new Date()
  const year = now.getFullYear() - 1
  const yearMonths: string[] = []
  for (let m = 1; m <= 12; m++) {
    yearMonths.push(`${year}-${String(m).padStart(2, '0')}`)
  }

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: nbsRateRaw },
    { data: creditsRaw },
    { data: savingsRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, month, category_id, skip_accounting, household_id')
      .in('month', yearMonths),
    supabase.from('categories').select('id, name'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('credits').select('name, monthly_payment, currency, remaining_amount, household_id').eq('status', 'aktivan'),
    supabase.from('savings').select('amount, household_id'),
  ])

  const eurToRsd = (nbsRateRaw as any)?.eur_to_rsd ?? 117
  const toRSD = (a: number, c: string) => c === 'EUR' ? a * eurToRsd : a
  const catMap = new Map((catsRaw ?? []).map((c: any) => [c.id, c.name]))
  const txs = (txsRaw ?? []).filter((t: any) => !t.skip_accounting)

  const householdMap = new Map<string, typeof txs>()
  for (const t of txs) {
    if (!t.household_id) continue
    if (!householdMap.has(t.household_id)) householdMap.set(t.household_id, [])
    householdMap.get(t.household_id)!.push(t)
  }

  const creditsByHousehold = new Map<string, any[]>()
  for (const c of creditsRaw ?? []) {
    if (!c.household_id) continue
    if (!creditsByHousehold.has(c.household_id)) creditsByHousehold.set(c.household_id, [])
    creditsByHousehold.get(c.household_id)!.push(c)
  }

  const savingsByHousehold = new Map<string, number>()
  for (const s of savingsRaw ?? []) {
    if (!s.household_id) continue
    savingsByHousehold.set(s.household_id, (savingsByHousehold.get(s.household_id) ?? 0) + s.amount)
  }

  let sent = 0
  for (const [householdId, htxs] of householdMap) {
    const rashodiTotal = htxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const prihodiTotal = htxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    if (rashodiTotal === 0 && prihodiTotal === 0) continue

    const catTotals: Record<string, number> = {}
    for (const t of htxs.filter((t: any) => t.type === 'rashod')) {
      const name = catMap.get(t.category_id)
      if (!name) continue
      catTotals[name] = (catTotals[name] ?? 0) + toRSD(t.amount, t.currency)
    }

    const meseci = yearMonths.map(m => {
      const mTxs = htxs.filter((t: any) => t.month === m)
      return {
        mesec: MONTHS[parseInt(m.split('-')[1]) - 1],
        rashodi: Math.round(mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)),
        prihodi: Math.round(mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)),
      }
    }).filter(m => m.rashodi > 0 || m.prihodi > 0)

    const topKategorije = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([naziv, iznos]) => ({ naziv, iznos: Math.round(iznos) }))

    const krediti = (creditsByHousehold.get(householdId) ?? []).map((c: any) => ({
      naziv: c.name,
      mesecnaRata: Math.round(toRSD(c.monthly_payment, c.currency)),
      preostaloIznos: Math.round(toRSD(c.remaining_amount, c.currency)),
    }))

    const ukupnaStednja = Math.round(savingsByHousehold.get(householdId) ?? 0)
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]

    const context = {
      period: `godina ${year}`,
      ukupniRashodi: Math.round(rashodiTotal),
      ukupniPrihodi: Math.round(prihodiTotal),
      ukupniBilans: Math.round(prihodiTotal - rashodiTotal),
      prosekRashodaMesecno: Math.round(rashodiTotal / 12),
      meseci,
      topKategorije,
      krediti,
      ukupnaStednja,
    }

    const parts = [`Rashodi: ${fmt(rashodiTotal)} din`]
    if (prihodiTotal > 0) parts.push(`prihodi: ${fmt(prihodiTotal)} din`)
    if (topCat) parts.push(`najvise: ${topCat[0]}`)
    if (ukupnaStednja > 0) parts.push(`stednja: ${fmt(ukupnaStednja)} din`)

    const insights = await generateInsights(context, `godinu ${year}`)

    const ok = await insertAndPush(supabase, {
      household_id: householdId,
      type: 'rezime_godisnji',
      title: `Godisnji presek ${year}.`,
      body: parts.join(' · '),
      data: { year, rashodiTotal: Math.round(rashodiTotal), prihodiTotal: Math.round(prihodiTotal), ukupnaStednja, insights },
      external_key: `godisnji_${year}`,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
