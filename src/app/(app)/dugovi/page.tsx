import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DugoviClient from './DugoviClient'

export default async function DugoviPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: debtsRaw }, { data: bucketsRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase.from('dugovi').select('*').order('created_at', { ascending: false }),
    supabase.from('buckets').select('id, name').order('name'),
    supabase.from('debt_payments').select('*, member:members(id, name)'),
  ])

  const buckets = bucketsRaw ?? []

  const debts = (debtsRaw ?? []).map((d: any) => {
    const payments = (paymentsRaw ?? []).filter((p: any) => p.debt_id === d.id)
    const paid = payments.reduce((s: number, p: any) => s + p.amount, 0)
    return { ...d, payments, paid, remaining: Math.max(0, d.total_amount - paid) }
  })

  const active = debts.filter((d: any) => d.status === 'aktivno')
  const dugujemo = active.filter((d: any) => d.direction === 'dugujemo')
  const dugujuNam = active.filter((d: any) => d.direction === 'duguju_nam')

  const totalDugujemo = dugujemo.reduce((s: number, d: any) => s + d.remaining, 0)
  const totalDugujuNam = dugujuNam.reduce((s: number, d: any) => s + d.remaining, 0)

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
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Pozajmice</p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Primljene pozajmice</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: dugujemo.length > 0 ? '#f87171' : 'var(--header-muted)' }}>
                {dugujemo.length > 0 ? new Intl.NumberFormat('sr-Latn-RS').format(Math.round(totalDugujemo)) : '—'}
                {dugujemo.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 6 }}>Date pozajmice</p>
              <p className="num" style={{ fontSize: 20, fontWeight: 500, color: dugujuNam.length > 0 ? 'var(--accent-on-dark)' : 'var(--header-muted)' }}>
                {dugujuNam.length > 0 ? new Intl.NumberFormat('sr-Latn-RS').format(Math.round(totalDugujuNam)) : '—'}
                {dugujuNam.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <DugoviClient debts={debts} buckets={buckets} />
      </div>
    </div>
  )
}
