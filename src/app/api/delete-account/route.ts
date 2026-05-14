import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function deleteAuthUser(supabaseAdmin: ReturnType<typeof admin>, userId: string) {
  await supabaseAdmin.from('transactions').delete().eq('user_id', userId)
  await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId)
  await supabaseAdmin.from('members').update({ user_id: null }).eq('user_id', userId)
  await supabaseAdmin.from('household_members').delete().eq('user_id', userId)
  return supabaseAdmin.auth.admin.deleteUser(userId)
}

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = admin()

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .single()

  if (membership?.role === 'owner' && membership.household_id) {
    const { data: others } = await supabaseAdmin
      .from('household_members')
      .select('user_id')
      .eq('household_id', membership.household_id)
      .neq('user_id', user.id)

    for (const m of others ?? []) {
      if (!m.user_id) continue
      const { error } = await deleteAuthUser(supabaseAdmin, m.user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await supabase.auth.signOut()
  const { error } = await deleteAuthUser(supabaseAdmin, user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
