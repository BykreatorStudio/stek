import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalitikaClient from './AnalitikaClient'

export default async function AnalitikaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()

  // Build last 12 months array
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
    { data: savingsRaw },
    { data: savingsHistoryRaw },
  ] = await Promise.all([
    supabase.from('transactions').select('type, amount, currency, month, category_id').gte('date', from).lte('date', to),
    supabase.from('categories').select('id, name'),
    supabase.from('savings').select('amount'),
    supabase.from('savings').select('amount, date').order('date', { ascending: true }),
  ])

  const txs = txsRaw ?? []
  const cats = catsRaw ?? []
  const totalSavings = (savingsRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0)

  // Build monthly data
  const monthlyData = months.map(m => {
    const mTxs = txs.filter((t: any) => t.month === m)
    const prihodi = mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + t.amount, 0)
    const rashodi = mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + t.amount, 0)
    const [year, mon] = m.split('-')
    const label = new Date(+year, +mon - 1, 1).toLocaleString('sr-Latn-RS', { month: 'short' })
    return { month: m, label: label.charAt(0).toUpperCase() + label.slice(1), prihodi, rashodi, bilans: prihodi - rashodi }
  })

  // Build category breakdown (last 3 months for donut)
  const catMap = new Map(cats.map((c: any) => [c.id, c.name]))
  const catTotals: Record<string, number> = {}
  txs.filter((t: any) => t.type === 'rashod' && t.category_id).forEach((t: any) => {
    const name = catMap.get(t.category_id) ?? 'Ostalo'
    catTotals[name] = (catTotals[name] ?? 0) + t.amount
  })
  const categoryData = Object.entries(catTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Savings over time (cumulative)
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
      categoryData={categoryData}
      savingsHistory={savingsHistory}
      totalSavings={totalSavings}
    />
  )
}
