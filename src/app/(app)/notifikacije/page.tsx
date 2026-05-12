'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notif = {
  id: string
  type: string
  title: string
  body: string
  created_at: string
  read_by: string[]
  triggered_by_member_id: string | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Upravo'
  if (mins < 60) return `Pre ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Pre ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Juče'
  if (days < 7) return `Pre ${days} dana`
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' })
}

function groupByDate(notifications: Notif[]) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups: { label: string; items: Notif[] }[] = []
  const map = new Map<string, Notif[]>()

  for (const n of notifications) {
    const d = new Date(n.created_at).toDateString()
    const label = d === today ? 'Danas' : d === yesterday ? 'Juče' : new Date(n.created_at).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long' })
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(n)
  }

  for (const [label, items] of map) groups.push({ label, items })
  return groups
}

function typeIcon(type: string) {
  const icons: Record<string, { d: string; color: string; bg: string }> = {
    transakcija_rashod: { d: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm7 5v4m0 4h.01', color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    transakcija_prihod: { d: 'M12 19V5M5 12l7-7 7 7', color: '#5a9700', bg: '#edf6d0' },
    sef_uplata:         { d: 'M12 19V5M5 12l7-7 7 7', color: '#5a9700', bg: '#edf6d0' },
    sef_isplata:        { d: 'M12 5v14M19 12l-7 7-7-7', color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    cek:                { d: 'M2 7h20v10H2zM7 7v10M10 11h7M10 14h4', color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
    dug_dodat:          { d: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    dug_placen:         { d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#5a9700', bg: '#edf6d0' },
    kredit_placen:      { d: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', color: '#5a9700', bg: '#edf6d0' },
    racun_placen:       { d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#5a9700', bg: '#edf6d0' },
    racun_upcoming:     { d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: '#b45309', bg: 'rgba(180,83,9,0.1)' },
    racun_overdue:      { d: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
  }
  return icons[type] ?? { d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'var(--text-2)', bg: 'var(--bg-subtle)' }
}

export default function NotifikacijePage() {
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [memberId, setMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: member }, { data: hm }] = await Promise.all([
        supabase.from('members').select('id').eq('user_id', user.id).single(),
        supabase.from('household_members').select('household_id').eq('user_id', user.id).single(),
      ])

      if (!member || !hm) return
      setMemberId(member.id)

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('household_id', hm.household_id)
        .order('created_at', { ascending: false })
        .limit(100)

      setNotifications(notifs ?? [])
      setLoading(false)

      await supabase.rpc('mark_notifications_read', {
        p_household_id: hm.household_id,
        p_member_id: member.id,
      })
    }
    load()
  }, [])

  const groups = groupByDate(notifications)

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p style={{ fontSize: 22, fontWeight: 500, color: 'var(--header-text)' }}>Notifikacije</p>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, paddingTop: 40 }}>Učitavanje...</p>
        ) : notifications.length === 0 ? (
          <div className="card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema notifikacija.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {groups.map(group => (
              <div key={group.label}>
                <p className="section-label">{group.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.items.map(n => {
                    const icon = typeIcon(n.type)
                    const unread = memberId ? !n.read_by.includes(memberId) : false
                    return (
                      <div key={n.id} className="card" style={{
                        padding: '14px 16px',
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        background: unread ? 'var(--card)' : 'var(--card)',
                        position: 'relative',
                      }}>
                        {unread && (
                          <div style={{
                            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                            width: 4, height: 4, borderRadius: '50%', background: '#f87171',
                          }} />
                        )}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: icon.bg,
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke={icon.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d={icon.d} />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{n.title}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{n.body}</p>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginLeft: 4, paddingTop: 2 }}>{timeAgo(n.created_at)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
