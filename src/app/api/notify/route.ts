import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const { householdId, triggeredByMemberId, type, title, body, data, externalKey } = await request.json()
  if (!householdId || !type || !title || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = admin()

  await supabase.from('notifications').insert({
    household_id: householdId,
    triggered_by_member_id: triggeredByMemberId || null,
    type, title, body,
    data: data || null,
    external_key: externalKey || null,
  })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key, user_id')
    .eq('household_id', householdId)

  if (!subs?.length) return NextResponse.json({ ok: true })

  let senderUserId: string | null = null
  if (triggeredByMemberId) {
    const { data: m } = await supabase
      .from('members').select('user_id').eq('id', triggeredByMemberId).single()
    senderUserId = m?.user_id ?? null
  }

  const payload = JSON.stringify({ title, body, data })
  await Promise.all(
    subs
      .filter(s => s.user_id !== senderUserId)
      .map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload
        ).catch(() => {})
      )
  )

  return NextResponse.json({ ok: true })
}
