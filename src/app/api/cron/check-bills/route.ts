import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function sendPushToHousehold(
  supabase: ReturnType<typeof admin>,
  householdId: string,
  title: string,
  body: string
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('household_id', householdId)
  if (!subs?.length) return
  const payload = JSON.stringify({ title, body })
  await Promise.all(
    subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
        payload
      ).catch(() => {})
    )
  )
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const month = todayStr.slice(0, 7)
  const todayDay = now.getDate()

  const [{ data: recurring }, { data: credits }, { data: households }] = await Promise.all([
    supabase.from('recurring_items').select('id, name, amount, currency, due_day, household_id').eq('is_active', true),
    supabase.from('credits').select('id, name, monthly_payment, currency, due_day, household_id').eq('status', 'aktivan'),
    supabase.from('households').select('id'),
  ])

  const monthStart = `${month}-01`
  const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${month}-${String(lastDayNum).padStart(2, '0')}`

  const [{ data: paidRecurring }, { data: paidCredits }] = await Promise.all([
    supabase.from('transactions').select('recurring_item_id').eq('month', month).not('recurring_item_id', 'is', null),
    supabase.from('credit_payments').select('credit_id').gte('date', monthStart).lte('date', monthEnd),
  ])

  const paidRecurringIds = new Set((paidRecurring ?? []).map((t: any) => t.recurring_item_id))
  const paidCreditIds = new Set((paidCredits ?? []).map((p: any) => p.credit_id))

  function fmt(n: number) {
    return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
  }

  const notifications: Array<{
    household_id: string; type: string; title: string; body: string
    data: object; external_key: string
  }> = []

  const ALERT_DAYS = [1, 3, 7]

  for (const item of recurring ?? []) {
    if (paidRecurringIds.has(item.id)) continue
    const daysUntil = item.due_day - todayDay
    if (ALERT_DAYS.includes(daysUntil)) {
      const label = daysUntil === 1 ? 'Sutra' : `Za ${daysUntil} dana`
      notifications.push({
        household_id: item.household_id,
        type: 'racun_upcoming',
        title: 'Uskoro za naplatu',
        body: `${item.name} · ${label}${item.amount ? ` · ${fmt(item.amount)} ${item.currency}` : ''}`,
        data: { name: item.name, days: daysUntil, amount: item.amount },
        external_key: `upcoming_${item.id}_${daysUntil}d_${todayStr}`,
      })
    }
    if (daysUntil < 0) {
      notifications.push({
        household_id: item.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje plaćanja',
        body: `${item.name} nije plaćen${item.amount ? ` · ${fmt(item.amount)} ${item.currency}` : ''}`,
        data: { name: item.name },
        external_key: `overdue_${item.id}_${todayStr}`,
      })
    }
  }

  for (const credit of credits ?? []) {
    if (paidCreditIds.has(credit.id)) continue
    const daysUntil = credit.due_day - todayDay
    if (ALERT_DAYS.includes(daysUntil)) {
      const label = daysUntil === 1 ? 'Sutra' : `Za ${daysUntil} dana`
      notifications.push({
        household_id: credit.household_id,
        type: 'racun_upcoming',
        title: 'Uskoro za naplatu',
        body: `Rata: ${credit.name} · ${label} · ${fmt(credit.monthly_payment)} ${credit.currency}`,
        data: { name: credit.name, days: daysUntil, amount: credit.monthly_payment },
        external_key: `upcoming_credit_${credit.id}_${daysUntil}d_${todayStr}`,
      })
    }
    if (daysUntil < 0) {
      notifications.push({
        household_id: credit.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje plaćanja',
        body: `Rata: ${credit.name} nije plaćena · ${fmt(credit.monthly_payment)} ${credit.currency}`,
        data: { name: credit.name },
        external_key: `overdue_credit_${credit.id}_${todayStr}`,
      })
    }
  }

  let sent = 0
  for (const n of notifications) {
    const { error } = await supabase.from('notifications').insert({
      household_id: n.household_id,
      type: n.type, title: n.title, body: n.body,
      data: n.data, external_key: n.external_key,
    })
    if (!error) {
      await sendPushToHousehold(supabase, n.household_id, n.title, n.body)
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
