import { NextRequest, NextResponse } from 'next/server'
import { admin, initWebpush, fmt, insertAndPush } from '../_utils'

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
    { data: nbsRateRaw },
    { data: savingsRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, skip_accounting, household_id')
      .eq('month', month),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('savings').select('amount, household_id'),
  ])

  const eurToRsd = (nbsRateRaw as any)?.eur_to_rsd ?? 117
  const toRSD = (a: number, c: string) => c === 'EUR' ? a * eurToRsd : a

  const txs = (txsRaw ?? []).filter((t: any) => !t.skip_accounting)

  const householdMap = new Map<string, typeof txs>()
  for (const t of txs) {
    if (!t.household_id) continue
    if (!householdMap.has(t.household_id)) householdMap.set(t.household_id, [])
    householdMap.get(t.household_id)!.push(t)
  }

  const savingsByHousehold = new Map<string, number>()
  for (const s of savingsRaw ?? []) {
    if (!s.household_id) continue
    savingsByHousehold.set(s.household_id, (savingsByHousehold.get(s.household_id) ?? 0) + s.amount)
  }

  let sent = 0
  for (const [householdId, htxs] of householdMap) {
    const rashodi = htxs
      .filter((t: any) => t.type === 'rashod')
      .reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const prihodi = htxs
      .filter((t: any) => t.type === 'prihod')
      .reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)

    if (rashodi === 0 && prihodi === 0) continue

    const bilans = prihodi - rashodi
    const bilansPart = bilans >= 0
      ? `slobodnih ${fmt(bilans)} din`
      : `minus ${fmt(Math.abs(bilans))} din`

    const ok = await insertAndPush(supabase, {
      household_id: householdId,
      type: 'rezime_mesecni',
      title: `Mesec ${monthLabel} zatvoren`,
      body: `Prihodi: ${fmt(prihodi)} din · Rashodi: ${fmt(rashodi)} din · ${bilansPart}`,
      data: { month, rashodi: Math.round(rashodi), prihodi: Math.round(prihodi), bilans: Math.round(bilans) },
      external_key: `mesecni_${month}`,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
