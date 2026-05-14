import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ClanoviClient from './ClanoviClient'

export default async function ClanoviPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: members }, { data: myHm }] = await Promise.all([
    supabase.from('household_members').select('*').order('created_at'),
    supabase.from('household_members').select('role').eq('user_id', user!.id).single(),
  ])

  const currentUserRole = myHm?.role ?? 'member'

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Članovi</p>
        </div>
      </div>
      <ClanoviClient members={members ?? []} currentUserId={user?.id ?? ''} currentUserRole={currentUserRole} />
    </div>
  )
}
