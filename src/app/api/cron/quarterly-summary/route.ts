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

  const qMonths: string[] = []
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    qMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const quarterLabel = `${MONTHS[firstMonth.getMonth()]}–${MONTHS[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: nbsRateRaw },
    { data: creditsRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, month, category_id, skip_accounting, household_id')
      .in('month', qMonths),
    supabase.from('categories').select('id, name'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('credits').select('name, monthly_payment, currency, remaining_amount, household_id').eq('status', 'aktivan'),
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

  let sent = 0
  for (const [householdId, htxs] of householdMap) {
    const rashodiTotal = htxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const prihodiTotal = htxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    if (rashodiTotal === 0 && prihodiTotal === 0) continue

    const avgRashodi = Math.round(rashodiTotal / 3)
    const bilans = prihodiTotal - rashodiTotal

    const catTotals: Record<string, number> = {}
    for (const t of htxs.filter((t: any) => t.type === 'rashod')) {
      const name = catMap.get(t.category_id)
      if (!name) continue
      catTotals[name] = (catTotals[name] ?? 0) + toRSD(t.amount, t.currency)
    }

    const meseci = qMonths.map(m => {
      const mTxs = htxs.filter((t: any) => t.month === m)
      return {
        mesec: MONTHS[parseInt(m.split('-')[1]) - 1],
        rashodi: Math.round(mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)),
        prihodi: Math.round(mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)),
      }
    })

    const topKategorije = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([naziv, iznos]) => ({ naziv, iznos: Math.round(iznos) }))

    const krediti = (creditsByHousehold.get(householdId) ?? []).map((c: any) => ({
      naziv: c.name,
      mesecnaRata: Math.round(toRSD(c.monthly_payment, c.currency)),
      preostaloIznos: Math.round(toRSD(c.remaining_amount, c.currency)),
    }))

    const context = {
      period: quarterLabel,
      meseci,
      prosekRashoda: avgRashodi,
      ukupanBilans: Math.round(bilans),
      topKategorije,
      krediti,
    }

    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
    const bilansPart = bilans >= 0 ? `ostalo ${fmt(bilans)} din` : `minus ${fmt(Math.abs(bilans))} din`
    const parts = [`Prosek rashoda: ${fmt(avgRashodi)} din/mes`]
    if (topCat) parts.push(`najveci trosak: ${topCat[0]}`)
    parts.push(bilansPart)

    const insights = await generateInsights(context, quarterLabel)

    const ok = await insertAndPush(supabase, {
      household_id: householdId,
      type: 'rezime_kvartalni',
      title: `Kvartal zavrsen — ${quarterLabel}`,
      body: parts.join(' · '),
      data: { months: qMonths, rashodiTotal: Math.round(rashodiTotal), prihodiTotal: Math.round(prihodiTotal), avgRashodi, insights },
      external_key: `kvartalni_${qMonths[0]}`,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
