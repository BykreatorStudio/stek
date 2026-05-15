import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import Anthropic from '@anthropic-ai/sdk'

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

export async function generateInsights(context: object, periodLabel: string): Promise<any[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `Ti si finansijski savetnik za srpsko domacinstvo. Analiziras finansijske podatke za ${periodLabel} i dajes konkretne, korisne savete.

Jezik: srpski, latinica. Pisati prirodno — bez stranih reci i birokratskog jezika.

Generisi onoliko uvida koliko ima smisla. Pravila:
- Tacni iznosi u dinarima (npr. "12.500 dinara", ne "12500 RSD")
- Konkretan savet — sta tacno uraditi
- Ako nema podataka za uvid, preskoci
- Ne izmisljaj podatke koji nisu u JSON-u

Vrati SAMO JSON niz, bez ikakvog teksta pre ili posle:
[{"tip":"upozorenje"|"savet"|"pozitivno","naslov":"Kratki naslov max 6 reci","opis":"Max 2-3 recenice sa tacknim brojevima."}]

Podaci:
${JSON.stringify(context, null, 2)}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (msg.content[0] as any).text ?? ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch {
    return []
  }
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
