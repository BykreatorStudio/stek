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

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId, userId } = await request.json()
  if (!memberId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data: hm } = await supabase.from('household_members').select('role').eq('user_id', user.id).single()
  if (hm?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabaseAdmin = admin()

  await supabaseAdmin.from('members').update({ user_id: null }).eq('id', memberId)
  await supabaseAdmin.from('household_members').delete().eq('user_id', userId)

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
