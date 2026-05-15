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
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = `${MONTHS[prev.getMonth()]} ${prev.getFullYear()}`

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: nbsRateRaw },
    { data: creditsRaw },
    { data: savingsRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, category_id, skip_accounting, household_id')
      .eq('month', month),
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
    const rashodi = htxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const prihodi = htxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    if (rashodi === 0 && prihodi === 0) continue

    const bilans = prihodi - rashodi
    const bilansPart = bilans >= 0 ? `slobodnih ${fmt(bilans)} din` : `minus ${fmt(Math.abs(bilans))} din`

    const catTotals: Record<string, number> = {}
    for (const t of htxs.filter((t: any) => t.type === 'rashod')) {
      const name = catMap.get(t.category_id)
      if (!name) continue
      catTotals[name] = (catTotals[name] ?? 0) + toRSD(t.amount, t.currency)
    }
    const kategorije = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([naziv, iznos]) => ({ naziv, iznos: Math.round(iznos) }))

    const krediti = (creditsByHousehold.get(householdId) ?? []).map((c: any) => ({
      naziv: c.name,
      mesecnaRata: Math.round(toRSD(c.monthly_payment, c.currency)),
      preostaloIznos: Math.round(toRSD(c.remaining_amount, c.currency)),
    }))

    const ukupnaStednja = Math.round(savingsByHousehold.get(householdId) ?? 0)

    const context = {
      period: monthLabel,
      rashodi: Math.round(rashodi),
      prihodi: Math.round(prihodi),
      bilans: Math.round(bilans),
      kategorije,
      krediti,
      ukupnaStednja,
    }

    const insights = await generateInsights(context, monthLabel)

    const ok = await insertAndPush(supabase, {
      household_id: householdId,
      type: 'rezime_mesecni',
      title: `Mesec ${monthLabel} zatvoren`,
      body: `Prihodi: ${fmt(prihodi)} din · Rashodi: ${fmt(rashodi)} din · ${bilansPart}`,
      data: { month, rashodi: Math.round(rashodi), prihodi: Math.round(prihodi), bilans: Math.round(bilans), insights },
      external_key: `mesecni_${month}`,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
