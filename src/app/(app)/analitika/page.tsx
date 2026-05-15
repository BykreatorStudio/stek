import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalitikaClient from './AnalitikaClient'

export default async function AnalitikaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()

  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const from = months[0] + '-01'
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const to = `${months[months.length - 1]}-${String(toDate.getDate()).padStart(2, '0')}`

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: bucketsRaw },
    { data: savingsRaw },
    { data: savingsHistoryRaw },
    { data: membersRaw },
    { data: nbsRateRaw },
  ] = await Promise.all([
    supabase.from('transactions').select('type, amount, currency, month, category_id, member_id').gte('date', from).lte('date', to),
    supabase.from('categories').select('id, name, bucket_id'),
    supabase.from('buckets').select('id, name'),
    supabase.from('savings').select('amount'),
    supabase.from('savings').select('amount, date').order('date', { ascending: true }),
    supabase.from('members').select('id, name').order('created_at'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
  ])

  const txs = txsRaw ?? []
  const cats = catsRaw ?? []
  const buckets = bucketsRaw ?? []
  const members = membersRaw ?? []
  const totalSavings = (savingsRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0)
  const eurToRsd = (nbsRateRaw as any)?.eur_to_rsd ?? 117
  const toRSD = (amount: number, currency: string) => currency === 'EUR' ? amount * eurToRsd : amount

  const catMap = new Map(cats.map((c: any) => [c.id, { name: c.name, bucketId: c.bucket_id }]))
  const bucketMap = new Map(buckets.map((b: any) => [b.id, b.name]))

  // Monthly data with per-category and per-bucket breakdown
  const monthlyData = months.map(m => {
    const mTxs = txs.filter((t: any) => t.month === m)
    const prihodi = mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
    const rashodi = mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)

    const catBreakdown: Record<string, number> = {}
    const bucketBreakdown: Record<string, number> = {}
    const memberBreakdown: Record<string, { prihodi: number; rashodi: number }> = {}

    mTxs.filter((t: any) => t.type === 'rashod').forEach((t: any) => {
      const amount = toRSD(t.amount, t.currency)
      if (t.category_id) {
        const cat = catMap.get(t.category_id)
        const catName = cat?.name ?? 'Ostalo'
        catBreakdown[catName] = (catBreakdown[catName] ?? 0) + amount
        const bucketName = cat?.bucketId ? (bucketMap.get(cat.bucketId) ?? 'Ostalo') : 'Ostalo'
        bucketBreakdown[bucketName] = (bucketBreakdown[bucketName] ?? 0) + amount
      } else {
        catBreakdown['Ostalo'] = (catBreakdown['Ostalo'] ?? 0) + amount
        bucketBreakdown['Ostalo'] = (bucketBreakdown['Ostalo'] ?? 0) + amount
      }
    })

    mTxs.forEach((t: any) => {
      if (!t.member_id) return
      if (!memberBreakdown[t.member_id]) memberBreakdown[t.member_id] = { prihodi: 0, rashodi: 0 }
      if (t.type === 'prihod') memberBreakdown[t.member_id].prihodi += toRSD(t.amount, t.currency)
      else if (t.type === 'rashod') memberBreakdown[t.member_id].rashodi += toRSD(t.amount, t.currency)
    })

    const [year, mon] = m.split('-')
    const label = new Date(+year, +mon - 1, 1).toLocaleString('sr-Latn-RS', { month: 'short' })
    return {
      month: m,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      prihodi,
      rashodi,
      bilans: prihodi - rashodi,
      catBreakdown,
      bucketBreakdown,
      memberBreakdown,
    }
  })

  // Savings cumulative
  const savingsHistory = (() => {
    let running = 0
    return (savingsHistoryRaw ?? []).map((s: any) => {
      running += s.amount
      const d = new Date(s.date)
      return {
        label: d.toLocaleString('sr-Latn-RS', { month: 'short', year: '2-digit' }),
        value: running,
      }
    })
  })()

  return (
    <AnalitikaClient
      monthlyData={monthlyData}
      savingsHistory={savingsHistory}
      totalSavings={totalSavings}
      members={members}
    />
  )
}
