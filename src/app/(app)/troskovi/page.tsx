import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TroskoviClient from './TroskoviClient'

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

export default async function TroskoviPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const params = await searchParams
  const month = params.month ?? currentMonth

  const [year, monthNum] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const lastDay = new Date(year, monthNum, 0).getDate()
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`
  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleString('sr-Latn-RS', { month: 'long', year: 'numeric' })

  const prevDate = new Date(year, monthNum - 2, 1)
  const nextDate = new Date(year, monthNum, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: txsRaw },
    { data: recurringRaw },
    { data: creditsRaw },
    { data: creditPaysRaw },
    { data: checksRaw },
    { data: debtsRaw },
    { data: debtPaysRaw },
    { data: bucketsRaw },
    { data: extraExpensesRaw },
    { data: nbsRateRaw },
  ] = await Promise.all([
    supabase.from('transactions').select('id, recurring_item_id, amount').eq('month', month).not('recurring_item_id', 'is', null),
    supabase.from('recurring_items').select('id, name, amount, currency, due_day, type, bucket_id, category_id').eq('is_active', true).eq('is_income', false).order('due_day'),
    supabase.from('credits').select('id, name, monthly_payment, due_day, bucket_id, currency, original_amount, remaining_amount').eq('status', 'aktivan').order('due_day'),
    supabase.from('credit_payments').select('id, credit_id').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('cekovi').select('id, quantity, date, status, note').gte('date', monthStart).lte('date', monthEnd).order('date'),
    supabase.from('dugovi').select('*'),
    supabase.from('debt_payments').select('id, debt_id, amount, currency, date, note'),
    supabase.from('buckets').select('id, name'),
    supabase.from('transactions').select('id, name, amount, currency, date, note, categories(name), buckets(name)').eq('month', month).eq('type', 'rashod').is('recurring_item_id', null).order('date', { ascending: false }),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
  ])

  const eurToRsd: number = nbsRateRaw?.eur_to_rsd ?? 117
  const toRSD = (amount: number, currency: string) => currency === 'EUR' ? amount * eurToRsd : amount

  const buckets = bucketsRaw ?? []
  const paidRecurringMap = new Map((txsRaw ?? []).map((t: any) => [t.recurring_item_id, { id: t.id, amount: t.amount }]))
  const paidCreditMap = new Map((creditPaysRaw ?? []).map((p: any) => [p.credit_id, p.id]))

  const recurring = (recurringRaw ?? []).map((r: any) => {
    const paidInfo = paidRecurringMap.get(r.id)
    const bucket = buckets.find((b: any) => b.id === r.bucket_id)
    return { ...r, bucketName: bucket?.name ?? '', paid: !!paidInfo, paidAmount: paidInfo?.amount ?? null, transactionId: paidInfo?.id ?? null }
  })

  const credits = (creditsRaw ?? []).map((c: any) => {
    const bucket = buckets.find((b: any) => b.id === c.bucket_id)
    return { ...c, bucketName: bucket?.name ?? '', paid: paidCreditMap.has(c.id), creditPaymentId: paidCreditMap.get(c.id) ?? null }
  })

  const checks = checksRaw ?? []

  const extraExpenses = (extraExpensesRaw ?? []).map((t: any) => ({
    id: t.id,
    name: t.name ?? '',
    amount: t.amount,
    currency: t.currency,
    date: t.date,
    note: t.note ?? null,
    categoryName: t.categories?.name ?? '',
    bucketName: t.buckets?.name ?? '',
  }))

  const debts = (debtsRaw ?? []).map((d: any) => {
    const payments = (debtPaysRaw ?? []).filter((p: any) => p.debt_id === d.id)
    const paid = payments.reduce((s: number, p: any) => s + p.amount, 0)
    return { ...d, payments, paid, remaining: Math.max(0, d.total_amount - paid) }
  })

  const activeDebts = debts.filter((d: any) => d.status === 'aktivno')
  const settledDebtsThisMonth = debts.filter((d: any) =>
    d.status === 'izmireno' &&
    d.payments.some((p: any) => p.date >= monthStart && p.date <= monthEnd)
  )

  // --- Stats ---
  const allChecks = checks
  const pendingChecks = allChecks.filter((c: any) => c.status === 'na_cekanju')
  const paidChecks = allChecks.filter((c: any) => c.status === 'isplacen')

  const grossTotal =
    recurring.reduce((s: number, r: any) => s + toRSD(r.amount ?? 0, r.currency), 0) +
    credits.reduce((s: number, c: any) => s + toRSD(c.monthly_payment, c.currency), 0) +
    allChecks.reduce((s: number, c: any) => s + c.quantity * CEK_VALUE, 0) +
    activeDebts.reduce((s: number, d: any) => s + toRSD(d.remaining, d.currency), 0) +
    settledDebtsThisMonth.reduce((s: number, d: any) => s + toRSD(d.total_amount, d.currency), 0) +
    extraExpenses.reduce((s: number, e: any) => s + toRSD(e.amount, e.currency), 0)

  const remainingAmount =
    recurring.filter((r: any) => !r.paid).reduce((s: number, r: any) => s + toRSD(r.amount ?? 0, r.currency), 0) +
    credits.filter((c: any) => !c.paid).reduce((s: number, c: any) => s + toRSD(c.monthly_payment, c.currency), 0) +
    pendingChecks.reduce((s: number, c: any) => s + c.quantity * CEK_VALUE, 0) +
    activeDebts.reduce((s: number, d: any) => s + toRSD(d.remaining, d.currency), 0)

  // Item count
  const paidCount =
    recurring.filter((r: any) => r.paid).length +
    credits.filter((c: any) => c.paid).length +
    paidChecks.length +
    settledDebtsThisMonth.length
  const totalItems = recurring.length + credits.length + allChecks.length + activeDebts.length + settledDebtsThisMonth.length

  const allResolved = totalItems > 0 && paidCount === totalItems

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Link href={`/troskovi?month=${prevMonth}`} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 3, textTransform: 'capitalize' }}>{monthLabel}</p>
              <p style={{ fontSize: 22, fontWeight: 500, color: 'var(--header-text)' }}>Troškovi</p>
            </div>

            <Link href={`/troskovi?month=${nextMonth}`} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>

          {/* Hero: remaining */}
          <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 6 }}>Preostalo za izmirenje</p>
          <p className="num" style={{
            fontSize: 44, fontWeight: 500, lineHeight: 1, marginBottom: 20,
            color: allResolved ? 'var(--accent-on-dark)' : remainingAmount > 0 ? '#f87171' : 'var(--header-text)',
          }}>
            {fmt(remainingAmount)}
            <span style={{ fontSize: 20, color: 'var(--header-muted)', fontWeight: 400, marginLeft: 8 }}>RSD</span>
          </p>

          {/* Two stat boxes */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Ukupno za mesec</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: grossTotal > 0 ? 'var(--header-text)' : 'var(--header-muted)' }}>
                {grossTotal > 0 ? fmt(grossTotal) : '—'}
                {grossTotal > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Izmireno troškova</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: allResolved ? 'var(--accent-on-dark)' : 'var(--header-text)' }}>
                {paidCount}/{totalItems}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <TroskoviClient
          recurring={recurring}
          credits={credits}
          checks={checks}
          debts={debts}
          extraExpenses={extraExpenses}
          month={month}
          eurToRsd={eurToRsd}
          monthStart={monthStart}
          monthEnd={monthEnd}
        />
      </div>
    </div>
  )
}
