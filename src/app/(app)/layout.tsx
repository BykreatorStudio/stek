import BottomNav from '@/components/layout/BottomNav'
import RealtimeRefresher from '@/components/layout/RealtimeRefresher'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hm } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
  if (!hm) redirect('/setup')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <RealtimeRefresher householdId={hm.household_id} />
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)' }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
