import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import PodesavanjaClient from './PodesavanjaClient'

export default async function PodesavanjaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hm } = await supabase
    .from('household_members')
    .select('notif_enabled, notif_bills, notif_pozajmice, notif_cekovi, notif_ostalo')
    .eq('user_id', user.id)
    .single()

  const initialPrefs = {
    notif_enabled: hm?.notif_enabled ?? true,
    notif_bills: hm?.notif_bills ?? true,
    notif_pozajmice: hm?.notif_pozajmice ?? true,
    notif_cekovi: hm?.notif_cekovi ?? true,
    notif_ostalo: hm?.notif_ostalo ?? true,
  }

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Podešavanja</p>
        </div>
      </div>
      <PodesavanjaClient userEmail={user.email ?? ''} initialPrefs={initialPrefs} />
    </div>
  )
}
