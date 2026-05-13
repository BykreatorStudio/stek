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

async function sendPushToHousehold(
  supabase: ReturnType<typeof admin>,
  householdId: string,
  title: string,
  body: string,
  category: 'bills' | 'cekovi' | 'pozajmice' = 'bills'
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key, user_id')
    .eq('household_id', householdId)
  if (!subs?.length) return

  const userIds = subs.map((s: any) => s.user_id).filter(Boolean)
  const { data: prefs } = await supabase
    .from('household_members')
    .select('user_id, notif_enabled, notif_bills, notif_pozajmice, notif_cekovi, notif_ostalo')
    .in('user_id', userIds)
  const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]))

  const payload = JSON.stringify({ title, body })
  await Promise.all(
    subs
      .filter((s: any) => {
        const p: any = prefMap.get(s.user_id)
        if (!p) return true
        if (!p.notif_enabled) return false
        if (category === 'bills') return p.notif_bills
        if (category === 'cekovi') return p.notif_cekovi
        if (category === 'pozajmice') return p.notif_pozajmice
        return true
      })
      .map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload
        ).catch(() => {})
      )
  )
}

function daysUntilDate(dateStr: string, todayStr: string): number {
  const d1 = new Date(todayStr + 'T00:00:00')
  const d2 = new Date(dateStr + 'T00:00:00')
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}

function cekLabel(quantity: number): string {
  return quantity === 1 ? 'ček' : quantity < 5 ? 'čeka' : 'čekova'
}

export async function GET(request: NextRequest) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const month = todayStr.slice(0, 7)
  const todayDay = now.getDate()

  const monthStart = `${month}-01`
  const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${month}-${String(lastDayNum).padStart(2, '0')}`

  const [
    { data: recurring },
    { data: credits },
    { data: paidRecurring },
    { data: paidCredits },
    { data: pendingChecks },
    { data: activeDugovi },
  ] = await Promise.all([
    supabase.from('recurring_items').select('id, name, amount, currency, due_day, household_id').eq('is_active', true),
    supabase.from('credits').select('id, name, monthly_payment, currency, due_day, household_id').eq('status', 'aktivan'),
    supabase.from('transactions').select('recurring_item_id').eq('month', month).not('recurring_item_id', 'is', null),
    supabase.from('credit_payments').select('credit_id').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('cekovi').select('id, quantity, date, household_id').eq('status', 'na_cekanju'),
    supabase.from('dugovi').select('id, name, direction, total_amount, currency, start_date, household_id').eq('status', 'aktivno').not('start_date', 'is', null),
  ])

  const paidRecurringIds = new Set((paidRecurring ?? []).map((t: any) => t.recurring_item_id))
  const paidCreditIds = new Set((paidCredits ?? []).map((p: any) => p.credit_id))

  function fmt(n: number) {
    return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
  }

  const householdNotifications: Array<{
    household_id: string; type: string; title: string; body: string
    data: object; external_key: string; category: 'bills' | 'cekovi' | 'pozajmice'
  }> = []

  const globalNotifications: Array<{
    household_id: string; type: string; title: string; body: string
    data: object; external_key: string; category: 'bills' | 'cekovi' | 'pozajmice'
  }> = []

  const ALERT_DAYS = [1, 3, 7]

  // Mesečni računi
  for (const item of recurring ?? []) {
    if (paidRecurringIds.has(item.id)) continue
    const daysUntil = item.due_day - todayDay
    if (ALERT_DAYS.includes(daysUntil)) {
      const label = daysUntil === 1 ? 'Sutra' : `Za ${daysUntil} dana`
      householdNotifications.push({
        household_id: item.household_id,
        type: 'racun_upcoming',
        title: 'Uskoro za naplatu',
        body: `${item.name} · ${label}${item.amount ? ` · ${fmt(item.amount)} ${item.currency}` : ''}`,
        data: { name: item.name, days: daysUntil, amount: item.amount },
        external_key: `upcoming_${item.id}_${daysUntil}d_${todayStr}`,
        category: 'bills',
      })
    }
    if (daysUntil < 0) {
      householdNotifications.push({
        household_id: item.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje plaćanja',
        body: `${item.name} nije plaćen${item.amount ? ` · ${fmt(item.amount)} ${item.currency}` : ''}`,
        data: { name: item.name },
        external_key: `overdue_${item.id}_${todayStr}`,
        category: 'bills',
      })
    }
  }

  // Krediti
  for (const credit of credits ?? []) {
    if (paidCreditIds.has(credit.id)) continue
    const daysUntil = credit.due_day - todayDay
    if (ALERT_DAYS.includes(daysUntil)) {
      const label = daysUntil === 1 ? 'Sutra' : `Za ${daysUntil} dana`
      householdNotifications.push({
        household_id: credit.household_id,
        type: 'racun_upcoming',
        title: 'Uskoro za naplatu',
        body: `Rata: ${credit.name} · ${label} · ${fmt(credit.monthly_payment)} ${credit.currency}`,
        data: { name: credit.name, days: daysUntil, amount: credit.monthly_payment },
        external_key: `upcoming_credit_${credit.id}_${daysUntil}d_${todayStr}`,
        category: 'bills',
      })
    }
    if (daysUntil < 0) {
      householdNotifications.push({
        household_id: credit.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje plaćanja',
        body: `Rata: ${credit.name} nije plaćena · ${fmt(credit.monthly_payment)} ${credit.currency}`,
        data: { name: credit.name },
        external_key: `overdue_credit_${credit.id}_${todayStr}`,
        category: 'bills',
      })
    }
  }

  // Čekovi
  for (const cek of pendingChecks ?? []) {
    const days = daysUntilDate(cek.date, todayStr)
    const qLabel = `${cek.quantity} ${cekLabel(cek.quantity)}`
    if (ALERT_DAYS.includes(days)) {
      const label = days === 1 ? 'Sutra' : `Za ${days} dana`
      globalNotifications.push({
        household_id: cek.household_id,
        type: 'racun_upcoming',
        title: 'Ček uskoro na naplatu',
        body: `${qLabel} · ${label} · ${fmt(cek.quantity * 5000)} RSD`,
        data: { quantity: cek.quantity, days },
        external_key: `cek_upcoming_${cek.id}_${days}d_${todayStr}`,
        category: 'cekovi',
      })
    }
    if (days < 0) {
      globalNotifications.push({
        household_id: cek.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje — Ček nije isplaćen',
        body: `${qLabel} · ${fmt(cek.quantity * 5000)} RSD`,
        data: { quantity: cek.quantity },
        external_key: `cek_overdue_${cek.id}_${todayStr}`,
        category: 'cekovi',
      })
    }
  }

  // Dugovi sa datumom dospeća
  for (const debt of activeDugovi ?? []) {
    const days = daysUntilDate(debt.start_date, todayStr)
    if (ALERT_DAYS.includes(days)) {
      const label = days === 1 ? 'Sutra' : `Za ${days} dana`
      const direction = debt.direction === 'dugujemo' ? 'Dugujemo' : 'Duguju nam'
      globalNotifications.push({
        household_id: debt.household_id,
        type: 'racun_upcoming',
        title: 'Pozajmica uskoro dospe',
        body: `${direction}: ${debt.name} · ${label} · ${fmt(debt.total_amount)} ${debt.currency}`,
        data: { name: debt.name, days },
        external_key: `dug_upcoming_${debt.id}_${days}d_${todayStr}`,
        category: 'pozajmice',
      })
    }
    if (days < 0) {
      const direction = debt.direction === 'dugujemo' ? 'Dugujemo' : 'Duguju nam'
      globalNotifications.push({
        household_id: debt.household_id,
        type: 'racun_overdue',
        title: 'Kašnjenje — Pozajmica nije izmirena',
        body: `${direction}: ${debt.name} · ${fmt(debt.total_amount)} ${debt.currency}`,
        data: { name: debt.name },
        external_key: `dug_overdue_${debt.id}_${todayStr}`,
        category: 'pozajmice',
      })
    }
  }

  let sent = 0

  for (const n of householdNotifications) {
    const { error } = await supabase.from('notifications').insert({
      household_id: n.household_id,
      type: n.type, title: n.title, body: n.body,
      data: n.data, external_key: n.external_key,
    })
    if (!error) {
      await sendPushToHousehold(supabase, n.household_id, n.title, n.body, n.category)
      sent++
    }
  }

  for (const n of globalNotifications) {
    const { error } = await supabase.from('notifications').insert({
      household_id: n.household_id,
      type: n.type, title: n.title, body: n.body,
      data: n.data, external_key: n.external_key,
    })
    if (!error) {
      await sendPushToHousehold(supabase, n.household_id, n.title, n.body, n.category)
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
