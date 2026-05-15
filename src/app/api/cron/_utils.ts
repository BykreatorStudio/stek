import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export function initWebpush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

export function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

export async function sendPushToHousehold(
  supabase: ReturnType<typeof admin>,
  householdId: string,
  title: string,
  body: string
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .eq('household_id', householdId)

  const validSubs = (subs ?? []).filter((s: any) => s.subscription?.endpoint)
  if (!validSubs.length) return

  const userIds = validSubs.map((s: any) => s.user_id).filter(Boolean)
  const { data: prefs } = await supabase
    .from('household_members')
    .select('user_id, notif_enabled, notif_ostalo')
    .in('user_id', userIds)
  const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]))

  const payload = JSON.stringify({ title, body })
  await Promise.all(
    validSubs
      .filter((s: any) => {
        const p: any = prefMap.get(s.user_id)
        if (!p) return true
        if (!p.notif_enabled) return false
        return p.notif_ostalo ?? true
      })
      .map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.subscription.endpoint, keys: { p256dh: s.subscription.keys.p256dh, auth: s.subscription.keys.auth } },
          payload
        ).catch(() => {})
      )
  )
}

export async function insertAndPush(
  supabase: ReturnType<typeof admin>,
  n: { household_id: string; type: string; title: string; body: string; data: object; external_key: string }
) {
  const { error } = await supabase.from('notifications').insert({
    household_id: n.household_id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data,
    external_key: n.external_key,
  })
  if (!error) {
    await sendPushToHousehold(supabase, n.household_id, n.title, n.body)
  }
  return !error
}
