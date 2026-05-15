import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TransakcijeSection from './TransakcijeSection'
import MemberStats from './MemberStats'
import NotifBell from '@/components/layout/NotifBell'

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function daysUntilLabel(diff: number): string {
  if (diff < 0) return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dan' : 'dana'} kašnjenja`
  if (diff === 0) return 'Danas'
  if (diff === 1) return 'Sutra'
  return `Za ${diff} dana`
}

function getEffectiveDueDate(dueDay: number, today: Date): Date {
  const y = today.getFullYear()
  const m = today.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  const thisMonth = new Date(y, m, Math.min(dueDay, lastDay))
  if (thisMonth >= today) return thisMonth
  const nextLastDay = new Date(y, m + 2, 0).getDate()
  return new Date(y, m + 1, Math.min(dueDay, nextLastDay))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('sr-Latn-RS', { month: 'long', year: 'numeric' })
  const monthStart = `${month}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`

  const [
    { data: profileRaw },
    { data: txs },
    { data: recurringRaw },
    { data: checksThisMonthRaw },
    { data: checksUpcomingRaw },
    { data: creditsRaw },
    { data: creditPaysRaw },
    { data: debtsRaw },
    { data: debtPaysRaw },
    { data: savingsRaw },
    { data: savingsThisMonthRaw },
    { data: membersRaw },
    { data: nbsRateRaw },
    { data: recentTxsRaw },
    { data: recentSavingsRaw },
    { data: recentReceiptsRaw },
  ] = await Promise.all([
    supabase.from('members').select('name').eq('user_id', user.id).single(),
    supabase.from('transactions').select('*, member:members(name), category:categories(name, bucket:buckets(name))').eq('month', month),
    supabase.from('recurring_items').select('*').eq('is_active', true),
    supabase.from('cekovi').select('id, quantity, status').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('cekovi').select('id, quantity, date').eq('status', 'na_cekanju'),
    supabase.from('credits').select('*').eq('status', 'aktivan'),
    supabase.from('credit_payments').select('credit_id').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('dugovi').select('*'),
    supabase.from('debt_payments').select('debt_id, amount, currency, date'),
    supabase.from('savings').select('amount'),
    supabase.from('savings').select('amount').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('members').select('*').not('user_id', 'is', null).order('created_at'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('transactions').select('id, type, name, amount, currency, date, created_at, member:members(name), category:categories(name, bucket:buckets(name))').is('receipt_id', null).order('created_at', { ascending: false }).limit(10),
    supabase.from('savings').select('id, amount, date, created_at, sef:sefovi(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('receipts').select('id, merchant_name, total_amount, date, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const transactions = txs ?? []
  const recurring = recurringRaw ?? []
  const recurringExpense = recurring.filter((r: any) => !r.is_income)
  const recurringIncome = recurring.filter((r: any) => r.is_income)
  const checksThisMonth = checksThisMonthRaw ?? []
  const checksUpcoming = checksUpcomingRaw ?? []
  const credits = creditsRaw ?? []
  const creditPays = creditPaysRaw ?? []
  const allDebts = debtsRaw ?? []
  const debtPays = debtPaysRaw ?? []
  const members = membersRaw ?? []
  const recentTxs = recentTxsRaw ?? []
  const savingsEntries = (recentSavingsRaw ?? []).map((s: any) => ({
    id: `sef-${s.id}`,
    type: s.amount > 0 ? 'sef_uplata' : 'sef_isplata',
    name: s.amount > 0 ? `Uplata u sef "${s.sef?.name ?? 'Sef'}"` : `Isplata iz sefa "${s.sef?.name ?? 'Sef'}"`,
    amount: Math.abs(s.amount),
    currency: 'RSD',
    date: s.date,
    created_at: s.created_at,
  }))
  const receiptEntries = (recentReceiptsRaw ?? []).map((r: any) => ({
    id: `receipt-${r.id}`,
    receiptId: r.id,
    type: 'receipt',
    name: r.merchant_name || 'Fiskalni račun',
    amount: r.total_amount,
    currency: 'RSD',
    date: r.date,
    created_at: r.created_at,
  }))
  const allRecent = [...recentTxs, ...savingsEntries, ...receiptEntries]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
  const eurToRsd: number = (nbsRateRaw as any)?.eur_to_rsd ?? 117
  const paidCreditIds = new Set(creditPays.map((p: any) => p.credit_id))

  // --- Month cash flow ---
  const toRSD = (amount: number, currency: string) => currency === 'EUR' ? amount * eurToRsd : amount

  const totalPrihodi = transactions.filter((t: any) => t.type === 'prihod' && !t.skip_accounting).reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
  const totalRashodi = transactions.filter((t: any) => t.type === 'rashod' && !t.skip_accounting).reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
  const neto_savings = (savingsThisMonthRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0)

  const debtPaysThisMonth = debtPays.filter((p: any) => p.date >= monthStart && p.date <= monthEnd)
  const totalCekRashodi = checksThisMonth.filter((c: any) => c.status === 'isplacen').reduce((s: number, c: any) => s + c.quantity * CEK_VALUE, 0)
  const totalDugRashodi = debtPaysThisMonth.filter((p: any) => allDebts.find((d: any) => d.id === p.debt_id)?.direction === 'dugujemo').reduce((s: number, p: any) => s + toRSD(p.amount, p.currency), 0)
  const extraIncome = debtPaysThisMonth.filter((p: any) => allDebts.find((d: any) => d.id === p.debt_id)?.direction === 'duguju_nam').reduce((s: number, p: any) => s + toRSD(p.amount, p.currency), 0)

  const dostupno = (totalPrihodi + extraIncome) - (totalRashodi + totalCekRashodi + totalDugRashodi) - neto_savings
  const hasData = transactions.length > 0 || neto_savings !== 0 || totalCekRashodi > 0 || totalDugRashodi > 0 || extraIncome > 0

  // --- Debts split (mirror troškovi logic exactly) ---
  const allDebtsWithPaid = allDebts.map((d: any) => {
    const paid = debtPays.filter((p: any) => p.debt_id === d.id).reduce((s: number, p: any) => s + p.amount, 0)
    return { ...d, remaining: Math.max(0, d.total_amount - paid) }
  })
  const activeDebts = allDebtsWithPaid.filter((d: any) => d.status === 'aktivno')
  const settledDebtsThisMonth = allDebtsWithPaid.filter((d: any) =>
    d.status === 'izmireno' &&
    debtPays.some((p: any) => p.debt_id === d.id && p.date >= monthStart && p.date <= monthEnd)
  )

  // --- Monthly obligations (identical to troškovi) ---
  const paidRecurringExpenseIds = new Set(transactions.filter((t: any) => t.recurring_item_id && t.type === 'rashod').map((t: any) => t.recurring_item_id))
  const paidRecurringIncomeIds = new Set(transactions.filter((t: any) => t.recurring_item_id && t.type === 'prihod').map((t: any) => t.recurring_item_id))
  const paidRecurringCount = recurringExpense.filter((r: any) => paidRecurringExpenseIds.has(r.id)).length
  const paidCreditCount = credits.filter((c: any) => paidCreditIds.has(c.id)).length
  const paidChecksThisMonth = checksThisMonth.filter((c: any) => c.status === 'isplacen').length
  const paidCount = paidRecurringCount + paidCreditCount + paidChecksThisMonth + settledDebtsThisMonth.length
  const totalObligations = recurringExpense.length + credits.length + checksThisMonth.length + activeDebts.length + settledDebtsThisMonth.length
  const allPaid = totalObligations > 0 && paidCount === totalObligations

  // Fixed monthly totals
  const fixedTotal = recurringExpense.filter((r: any) => r.type === 'fiksni').reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

  // Income tracking
  const receivedIncomeCount = recurringIncome.filter((r: any) => paidRecurringIncomeIds.has(r.id)).length
  const creditTotal = credits.reduce((s: number, c: any) => s + c.monthly_payment, 0)

  // --- Financial picture (only active debts) ---
  const safBalance = (savingsRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0)
  const totalDugujemo = activeDebts.filter((d: any) => d.direction === 'dugujemo').reduce((s: number, d: any) => s + d.remaining, 0)
  const totalDugujuNam = activeDebts.filter((d: any) => d.direction === 'duguju_nam').reduce((s: number, d: any) => s + d.remaining, 0)
  const totalKrediti = credits.reduce((s: number, c: any) => s + c.remaining_amount, 0)

  // --- By member ---
  const memberStats = members.map((m: any) => {
    const mTxs = transactions.filter((t: any) => t.member_id === m.id)
    const prihodi = mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + t.amount, 0)
    const rashodi = mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + t.amount, 0)
    return { id: m.id, name: m.name, avatar_url: m.avatar_url ?? null, prihodi, rashodi, count: mTxs.length, txs: mTxs }
  })

  // --- Upcoming & overdue (next 15 days + any overdue) ---
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in15 = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)

  type UpcomingItem = { name: string; amount: number; currency: string; dueDate: Date; label: string; overdue: boolean }
  const upcomingItems: UpcomingItem[] = []

  for (const r of recurringExpense) {
    if (paidRecurringExpenseIds.has(r.id)) continue
    const dueDate = getEffectiveDueDate(r.due_day, today)
    if (dueDate <= in15) {
      const diff = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      upcomingItems.push({ name: r.name, amount: r.amount ?? 0, currency: r.currency, dueDate, label: daysUntilLabel(diff), overdue: diff < 0 })
    }
  }
  for (const c of credits) {
    if (paidCreditIds.has(c.id)) continue
    const dueDate = getEffectiveDueDate(c.due_day, today)
    if (dueDate <= in15) {
      const diff = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      upcomingItems.push({ name: c.name, amount: c.monthly_payment, currency: c.currency, dueDate, label: daysUntilLabel(diff), overdue: diff < 0 })
    }
  }
  for (const c of checksUpcoming) {
    const cDate = new Date((c as any).date + 'T00:00:00')
    if (cDate <= in15) {
      const diff = Math.round((cDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const qty = (c as any).quantity
      upcomingItems.push({
        name: `${qty} ${qty === 1 ? 'ček' : qty < 5 ? 'čeka' : 'čekova'}`,
        amount: qty * CEK_VALUE,
        currency: 'RSD',
        dueDate: cDate,
        label: daysUntilLabel(diff),
        overdue: diff < 0,
      })
    }
  }
  for (const d of activeDebts) {
    if (!(d as any).start_date) continue
    const dDate = new Date((d as any).start_date + 'T00:00:00')
    if (dDate <= in15) {
      const diff = Math.round((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const toRsd = (d as any).currency === 'EUR' ? (d as any).remaining * eurToRsd : (d as any).remaining
      upcomingItems.push({
        name: (d as any).name,
        amount: toRsd,
        currency: 'RSD',
        dueDate: dDate,
        label: daysUntilLabel(diff),
        overdue: diff < 0,
      })
    }
  }
  upcomingItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 3 }}>{cap(monthLabel)}</p>
              <p style={{ fontSize: 18, color: 'var(--header-text)', fontWeight: 500 }}>Zdravo, {(profileRaw as any)?.name}</p>
            </div>
            <NotifBell />
          </div>

          {/* Hero balance */}
          <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 6 }}>Dostupno ovog meseca</p>
          <p className="num" style={{
            fontSize: 44, fontWeight: 500, lineHeight: 1, marginBottom: 18,
            color: !hasData ? 'var(--header-text)' : dostupno >= 0 ? 'var(--accent-on-dark)' : '#f87171',
          }}>
            {!hasData ? '—' : (dostupno >= 0 ? '+' : '-') + fmt(dostupno)}
            {hasData && <span style={{ fontSize: 20, color: 'var(--header-muted)', fontWeight: 400, marginLeft: 8 }}>RSD</span>}
          </p>

          {/* Prihodi / Rashodi / Sefovi */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Prihodi</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: totalPrihodi > 0 ? 'var(--accent-on-dark)' : 'var(--header-muted)' }}>
                {totalPrihodi > 0 ? fmt(totalPrihodi) : '—'}
                {totalPrihodi > 0 && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Rashodi</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: totalRashodi > 0 ? '#f87171' : 'var(--header-muted)' }}>
                {totalRashodi > 0 ? fmt(totalRashodi) : '—'}
                {totalRashodi > 0 && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Sefovi</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: neto_savings > 0 ? 'var(--accent-on-dark)' : 'var(--header-muted)' }}>
                {neto_savings > 0 ? fmt(neto_savings) : '—'}
                {neto_savings > 0 && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        {/* --- Ovaj mesec --- */}
        {(totalObligations > 0 || recurringIncome.length > 0) && (
          <>
            <p className="section-label">Ovaj mesec</p>

            {recurringIncome.length > 0 && (
              <Link href="/mesecni-racuni" style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Stalni prihodi</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {receivedIncomeCount} od {recurringIncome.length} primljeno
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                        background: receivedIncomeCount === recurringIncome.length ? 'var(--accent-light)' : 'rgba(248,113,113,0.12)',
                        color: receivedIncomeCount === recurringIncome.length ? 'var(--accent-dark)' : 'var(--red)',
                      }}>
                        {receivedIncomeCount === recurringIncome.length ? 'Sve primljeno' : `${recurringIncome.length - receivedIncomeCount} čeka`}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {totalObligations > 0 && (
              <Link href="/troskovi" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Mesečne obaveze</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {paidCount} od {totalObligations} izmireno
                        {fixedTotal + creditTotal > 0 ? ` · ${fmt(fixedTotal + creditTotal)} RSD` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                        background: allPaid ? 'var(--accent-light)' : 'rgba(248,113,113,0.12)',
                        color: allPaid ? 'var(--accent-dark)' : 'var(--red)',
                      }}>
                        {allPaid ? 'Sve izmireno' : `${totalObligations - paidCount} preostalo`}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, background: 'var(--accent)',
                      width: totalObligations > 0 ? `${(paidCount / totalObligations) * 100}%` : '0%',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </Link>
            )}
          </>
        )}

        {/* --- Finansijska slika --- */}
        <p className="section-label">Finansijska slika</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>

          <Link href="/stednja" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 40 38" fill="var(--accent-dark)">
                    <path d="M7.5,38c-.7,0-1.36-.23-1.97-.7-.62-.47-1.02-1.03-1.23-1.7-.83-2.87-1.53-5.34-2.08-7.42-.55-2.08-.99-3.91-1.32-5.48-.33-1.57-.56-2.97-.7-4.19-.14-1.22-.21-2.39-.21-3.5,0-3.07,1.07-5.67,3.2-7.8,2.13-2.13,4.73-3.2,7.8-3.2h10c.9-1.2,2.04-2.17,3.42-2.9,1.38-.73,2.91-1.1,4.58-1.1.83,0,1.54.29,2.12.88s.88,1.29.88,2.12c0,.2-.03.4-.08.6s-.11.38-.17.55c-.13.37-.26.73-.38,1.1-.12.37-.21.77-.28,1.2l4.55,4.55h2.85c.42,0,.78.14,1.07.43.29.29.43.64.43,1.07v11.35c0,.34-.09.64-.28.91-.18.26-.44.44-.78.54l-4.6,1.51-2.7,9.03c-.2.65-.56,1.18-1.09,1.57-.53.39-1.13.58-1.81.58h-5.75c-.83,0-1.53-.29-2.12-.88-.59-.59-.88-1.29-.88-2.12v-1h-4v1c0,.83-.29,1.53-.88,2.12-.59.59-1.29.88-2.12.88h-5.5ZM7.25,35h5.75v-4h10v4h5.75l3.15-10.5,5.1-1.75v-8.75h-2.6l-6.4-6.4c.03-.57.12-1.26.28-2.07.15-.82.36-1.72.62-2.72-1.43.37-2.7.92-3.8,1.65-1.1.73-1.9,1.58-2.4,2.55h-11.7c-2.21,0-4.1.78-5.66,2.34-1.56,1.56-2.34,3.45-2.34,5.66,0,1.4.37,3.84,1.1,7.33.73,3.48,1.78,7.71,3.15,12.67ZM28,18c.57,0,1.04-.19,1.42-.58s.58-.86.58-1.42-.19-1.04-.58-1.42-.86-.58-1.42-.58-1.04.19-1.42.58-.58.86-.58,1.42.19,1.04.58,1.42.86.58,1.42.58ZM20.5,13c.42,0,.78-.14,1.07-.43.29-.29.43-.65.43-1.07s-.14-.78-.43-1.07c-.29-.28-.64-.43-1.07-.43h-7c-.42,0-.78.14-1.07.43-.29.29-.43.65-.43,1.07s.14.78.43,1.07c.29.28.64.42,1.07.42h7Z" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Štednja</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Svi sefovi</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p className="num" style={{ fontSize: 15, fontWeight: 500, color: safBalance > 0 ? 'var(--accent)' : safBalance < 0 ? 'var(--red)' : 'var(--text-3)' }}>
                  {savingsRaw && savingsRaw.length > 0 ? `${fmt(safBalance)} RSD` : '—'}
                </p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </Link>

          {(totalDugujemo > 0 || totalDugujuNam > 0) && (
            <Link href="/dugovi" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 39 39" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5,11.5C5.28,5.14,12.15,1.5,19.54,1.5c9.36,0,17.05,7.1,17.96,16.2" />
                      <path d="M10.52,12.3H2.58c-.6,0-1.08-.48-1.08-1.08h0V3.3" />
                      <path d="M36.5,27.5c-2.78,6.36-9.64,10-17.04,10-9.36,0-17.05-7.1-17.96-16.2" />
                      <path d="M28.48,26.7h7.94c.6,0,1.08.48,1.08,1.08,0,0,0,0,0v7.92" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Pozajmice</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {totalDugujemo > 0 && `Primljene: ${fmt(totalDugujemo)} RSD`}
                      {totalDugujemo > 0 && totalDugujuNam > 0 && ' · '}
                      {totalDugujuNam > 0 && `Date: ${fmt(totalDugujuNam)} RSD`}
                    </p>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          )}

          {totalKrediti > 0 && (
            <Link href="/krediti" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="14" viewBox="0 0 38.76 28.03" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M37.26,8.65v14.3c0,1.97-1.6,3.58-3.58,3.58H5.08c-1.98,0-3.58-1.6-3.58-3.58V5.08c0-1.97,1.6-3.58,3.58-3.58h28.61c1.98,0,3.58,1.6,3.58,3.58,0,0,0,3.58,0,3.58ZM37.26,8.65H1.5" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Krediti</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {credits.length} aktivan{credits.length !== 1 ? (credits.length < 5 ? 'a' : 'ih') : ''} · rata {fmt(creditTotal)} RSD/mes
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--red)' }}>{fmt(totalKrediti)} RSD</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* --- Po članovima --- */}
        {members.length > 0 && hasData && (
          <MemberStats memberStats={memberStats} month={cap(monthLabel)} />
        )}

        {/* --- Poslednje transakcije --- */}
        <TransakcijeSection recentTxs={allRecent} />

        {/* --- Uskoro za naplatu --- */}
        {upcomingItems.length > 0 && (
          <>
            <p className="section-label">Uskoro za naplatu</p>
            <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
              {upcomingItems.map((item, i) => {
                const urgent = item.overdue || item.label === 'Danas' || item.label === 'Sutra'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px',
                    borderBottom: i < upcomingItems.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: urgent ? 'var(--red)' : 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </p>
                      <p className="num" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{fmt(item.amount)} {item.currency}</p>
                    </div>
                    <span style={{
                      flexShrink: 0, marginLeft: 12,
                      fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                      background: urgent ? 'rgba(217,48,37,0.1)' : 'var(--bg-subtle)',
                      color: urgent ? 'var(--red)' : 'var(--text-2)',
                    }}>
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!hasData && allRecent.length === 0 && (
          <div className="card" style={{ padding: '24px 20px', textAlign: 'center', marginTop: 8 }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>
              Pritisni <span style={{ fontWeight: 500 }}>+</span> da dodaš prvu transakciju
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
