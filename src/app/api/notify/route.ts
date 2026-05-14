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
  const { householdId: householdIdParam, triggeredByMemberId, type, title, body, data, externalKey } = await request.json()
  if (!type || !title || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = admin()

  let householdId: string | null = householdIdParam ?? null
  let senderUserId: string | null = null

  if (triggeredByMemberId) {
    const { data: m } = await supabase
      .from('members').select('user_id').eq('id', triggeredByMemberId).single()
    senderUserId = m?.user_id ?? null

    if (!householdId && senderUserId) {
      const { data: hm } = await supabase
        .from('household_members').select('household_id').eq('user_id', senderUserId).single()
      householdId = hm?.household_id ?? null
    }
  }

  if (!householdId) return NextResponse.json({ ok: true })

  await supabase.from('notifications').insert({
    triggered_by_member_id: triggeredByMemberId || null,
    household_id: householdId,
    type, title, body,
    data: data || null,
    external_key: externalKey || null,
  })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .eq('household_id', householdId)

  const validSubs = (subs ?? []).filter((s: any) => s.subscription?.endpoint)
  if (!validSubs.length) return NextResponse.json({ ok: true })

  const userIds = validSubs.map((s: any) => s.user_id).filter(Boolean)
  const { data: prefs } = await supabase
    .from('household_members')
    .select('user_id, notif_enabled, notif_bills, notif_pozajmice, notif_cekovi, notif_ostalo')
    .in('user_id', userIds)

  const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]))

  function wantsNotif(userId: string): boolean {
    const p: any = prefMap.get(userId)
    if (!p) return true
    if (!p.notif_enabled) return false
    if (type.startsWith('dug_')) return p.notif_pozajmice
    if (type === 'cek' || type.startsWith('cek_')) return p.notif_cekovi
    if (type.startsWith('racun_') || type.startsWith('kredit_')) return p.notif_bills
    return p.notif_ostalo
  }

  const payload = JSON.stringify({ title, body, data })
  await Promise.all(
    validSubs
      .filter((s: any) => s.user_id !== senderUserId && wantsNotif(s.user_id))
      .map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.subscription.endpoint, keys: { p256dh: s.subscription.keys.p256dh, auth: s.subscription.keys.auth } },
          payload
        ).catch(() => {})
      )
  )

  return NextResponse.json({ ok: true })
}
