import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import KreditiClient from './KreditiClient'

export default async function KreditiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [{ data: creditsRaw }, { data: bucketsRaw }, { data: creditPaysRaw }] = await Promise.all([
    supabase.from('credits').select('*').eq('status', 'aktivan').order('created_at', { ascending: false }),
    supabase.from('buckets').select('id, name, sort_order').order('sort_order'),
    supabase.from('credit_payments').select('*'),
  ])

  const buckets = bucketsRaw ?? []

  const credits = (creditsRaw ?? []).map((c: any) => {
    const payments = (creditPaysRaw ?? []).filter((p: any) => p.credit_id === c.id)
    const paidThisMonth = payments.some(
      (p: any) => p.date >= monthStart && p.date <= monthEnd
    )
    const bucket = buckets.find((b: any) => b.id === c.bucket_id) ?? null
    return { ...c, payments, paidThisMonth, bucket }
  })

  const totalRemaining = credits.reduce((s: number, c: any) => s + c.remaining_amount, 0)
  const totalMonthly = credits.reduce((s: number, c: any) => s + c.monthly_payment, 0)

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', textDecoration: 'none' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Krediti</p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Ukupno preostalo</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: credits.length > 0 ? '#f87171' : 'var(--header-muted)' }}>
                {credits.length > 0 ? new Intl.NumberFormat('sr-Latn-RS').format(Math.round(totalRemaining)) : '—'}
                {credits.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Mesečne rate</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: credits.length > 0 ? 'var(--accent-on-dark)' : 'var(--header-muted)' }}>
                {credits.length > 0 ? new Intl.NumberFormat('sr-Latn-RS').format(Math.round(totalMonthly)) : '—'}
                {credits.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <KreditiClient credits={credits} buckets={buckets} />
      </div>
    </div>
  )
}
