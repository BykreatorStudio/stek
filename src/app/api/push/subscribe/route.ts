import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { endpoint, p256dh, auth, householdId } = await request.json()
  if (!endpoint || !p256dh || !auth || !householdId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, household_id: householdId, endpoint, p256dh, auth_key: auth },
    { onConflict: 'endpoint' }
  )

  return NextResponse.json({ ok: true })
}
