import { NextRequest, NextResponse } from 'next/server'
import { admin, initWebpush, fmt, insertAndPush } from '../_utils'

export async function GET(request: NextRequest) {
  initWebpush()
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const from = weekAgo.toISOString().split('T')[0]
  const to = now.toISOString().split('T')[0]

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: nbsRateRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, category_id, skip_accounting, household_id')
      .gte('date', from).lte('date', to),
    supabase.from('categories').select('id, name'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
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

  let sent = 0
  for (const [householdId, htxs] of householdMap) {
    const rashodi = htxs
      .filter((t: any) => t.type === 'rashod')
      .reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const prihodi = htxs
      .filter((t: any) => t.type === 'prihod')
      .reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)

    if (rashodi === 0 && prihodi === 0) continue

    const catTotals: Record<string, number> = {}
    for (const t of htxs.filter((t: any) => t.type === 'rashod')) {
      const name = catMap.get(t.category_id)
      if (!name) continue
      catTotals[name] = (catTotals[name] ?? 0) + toRSD(t.amount, t.currency)
    }
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]

    const parts = [`Potrošeno: ${fmt(rashodi)} din`]
    if (prihodi > 0) parts.push(`primljeno: ${fmt(prihodi)} din`)
    if (topCat) parts.push(`najviše: ${topCat[0]} (${fmt(topCat[1])} din)`)

    const ok = await insertAndPush(supabase, {
      household_id: householdId,
      type: 'rezime_nedeljni',
      title: 'Nedeljni rezime',
      body: parts.join(' · '),
      data: { from, to, rashodi: Math.round(rashodi), prihodi: Math.round(prihodi), topCategory: topCat?.[0] },
      external_key: `nedeljni_${from}`,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
