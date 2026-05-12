import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StednjaClient from './StednjaClient'

export default async function StednjaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('savings').select('*, member:members(id, name, color)').order('date', { ascending: false }).order('created_at', { ascending: false })

  const savings = data ?? []
  const balance = savings.reduce((s: number, r: any) => s + r.amount, 0)

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
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Sef</p>
          </div>

          <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 6 }}>Trenutno stanje</p>
          <p className="num" style={{
            fontSize: 44, fontWeight: 500, lineHeight: 1,
            color: balance > 0 ? 'var(--accent-on-dark)' : balance < 0 ? '#f87171' : 'var(--header-muted)',
          }}>
            {savings.length > 0 ? new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(balance))) : '—'}
            {savings.length > 0 && <span style={{ fontSize: 20, color: 'var(--header-muted)', fontWeight: 400, marginLeft: 8 }}>RSD</span>}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <StednjaClient savings={savings} balance={balance} />
      </div>
    </div>
  )
}
