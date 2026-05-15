'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import SwipeActions from '@/components/ui/SwipeActions'

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

const CEK_PATHS = [
  'M17.56,23.31l-6.05.86.86-6.05L27.93,2.57c.34-.34.74-.61,1.19-.79.44-.18.92-.28,1.4-.28s.96.09,1.4.28c.44.18.85.45,1.19.79.34.34.61.74.79,1.19.18.44.28.92.28,1.4s-.09.96-.28,1.4c-.18.44-.45.85-.79,1.19l-15.55,15.55Z',
  'M8.83,15.17H3.94c-.65,0-1.27.26-1.73.72-.46.46-.72,1.08-.72,1.73v17.11c0,.65.26,1.27.72,1.73.46.46,1.08.72,1.73.72h31.77c.65,0,1.27-.26,1.73-.72s.72-1.08.72-1.73v-17.11c0-.65-.26-1.27-.72-1.73-.46-.46-1.08-.72-1.73-.72h-2.44',
]
const KREDIT_PATHS = ['M37.26,8.65v14.3c0,1.97-1.6,3.58-3.58,3.58H5.08c-1.98,0-3.58-1.6-3.58-3.58V5.08c0-1.97,1.6-3.58,3.58-3.58h28.61c1.98,0,3.58,1.6,3.58,3.58,0,0,0,3.58,0,3.58ZM37.26,8.65H1.5']
const DUG_PATHS = [
  'M2.5,11.5C5.28,5.14,12.15,1.5,19.54,1.5c9.36,0,17.05,7.1,17.96,16.2',
  'M10.52,12.3H2.58c-.6,0-1.08-.48-1.08-1.08h0V3.3',
  'M36.5,27.5c-2.78,6.36-9.64,10-17.04,10-9.36,0-17.05-7.1-17.96-16.2',
  'M28.48,26.7h7.94c.6,0,1.08.48,1.08,1.08,0,0,0,0,0v7.92',
]
const SEF_PATH = 'M7.5,38c-.7,0-1.36-.23-1.97-.7-.62-.47-1.02-1.03-1.23-1.7-.83-2.87-1.53-5.34-2.08-7.42-.55-2.08-.99-3.91-1.32-5.48-.33-1.57-.56-2.97-.7-4.19-.14-1.22-.21-2.39-.21-3.5,0-3.07,1.07-5.67,3.2-7.8,2.13-2.13,4.73-3.2,7.8-3.2h10c.9-1.2,2.04-2.17,3.42-2.9,1.38-.73,2.91-1.1,4.58-1.1.83,0,1.54.29,2.12.88s.88,1.29.88,2.12c0,.2-.03.4-.08.6s-.11.38-.17.55c-.13.37-.26.73-.38,1.1-.12.37-.21.77-.28,1.2l4.55,4.55h2.85c.42,0,.78.14,1.07.43.29.29.43.64.43,1.07v11.35c0,.34-.09.64-.28.91-.18.26-.44.44-.78.54l-4.6,1.51-2.7,9.03c-.2.65-.56,1.18-1.09,1.57-.53.39-1.13.58-1.81.58h-5.75c-.83,0-1.53-.29-2.12-.88-.59-.59-.88-1.29-.88-2.12v-1h-4v1c0,.83-.29,1.53-.88,2.12-.59.59-1.29.88-2.12.88h-5.5ZM7.25,35h5.75v-4h10v4h5.75l3.15-10.5,5.1-1.75v-8.75h-2.6l-6.4-6.4c.03-.57.12-1.26.28-2.07.15-.82.36-1.72.62-2.72-1.43.37-2.7.92-3.8,1.65-1.1.73-1.9,1.58-2.4,2.55h-11.7c-2.21,0-4.1.78-5.66,2.34-1.56,1.56-2.34,3.45-2.34,5.66,0,1.4.37,3.84,1.1,7.33.73,3.48,1.78,7.71,3.15,12.67ZM28,18c.57,0,1.04-.19,1.42-.58s.58-.86.58-1.42-.19-1.04-.58-1.42-.86-.58-1.42-.58-1.04.19-1.42.58-.58.86-.58,1.42.19,1.04.58,1.42.86.58,1.42.58ZM20.5,13c.42,0,.78-.14,1.07-.43.29-.29.43-.65.43-1.07s-.14-.78-.43-1.07c-.29-.28-.64-.43-1.07-.43h-7c-.42,0-.78.14-1.07.43-.29.29-.43.65-.43,1.07s.14.78.43,1.07c.29.28.64.42,1.07.42h7Z'

type IconDef = { paths: string[]; viewBox: string; isFill?: boolean; color: string; bg: string }

function typeIcon(type: string): IconDef {
  const icons: Record<string, IconDef> = {
    transakcija_rashod: { viewBox: '0 0 24 24', paths: ['M12 5v14M19 12l-7 7-7-7'], color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    transakcija_prihod: { viewBox: '0 0 24 24', paths: ['M12 19V5M5 12l7-7 7 7'], color: '#5a9700', bg: '#edf6d0' },
    sef_uplata:         { viewBox: '0 0 40 38', paths: [SEF_PATH], isFill: true, color: '#5a9700', bg: '#edf6d0' },
    sef_isplata:        { viewBox: '0 0 40 38', paths: [SEF_PATH], isFill: true, color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    cek:                { viewBox: '0 0 39.66 38.67', paths: CEK_PATHS, color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
    dug_dodat:          { viewBox: '0 0 39 39', paths: DUG_PATHS, color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    dug_placen:         { viewBox: '0 0 39 39', paths: DUG_PATHS, color: '#5a9700', bg: '#edf6d0' },
    dug_izmiren:        { viewBox: '0 0 39 39', paths: DUG_PATHS, color: '#5a9700', bg: '#edf6d0' },
    kredit_placen:      { viewBox: '0 0 38.76 28.03', paths: KREDIT_PATHS, color: '#5a9700', bg: '#edf6d0' },
    kredit_dodat:       { viewBox: '0 0 38.76 28.03', paths: KREDIT_PATHS, color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
    racun_placen:       { viewBox: '0 0 24 24', paths: ['M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'], color: '#5a9700', bg: '#edf6d0' },
    racun_upcoming:     { viewBox: '0 0 24 24', paths: ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'], color: '#b45309', bg: 'rgba(180,83,9,0.1)' },
    racun_overdue:      { viewBox: '0 0 24 24', paths: ['M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'], color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
    ai_uvidi:           { viewBox: '0 0 24 24', paths: ['M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'], color: '#5a9700', bg: '#edf6d0' },
  }
  return icons[type] ?? { viewBox: '0 0 24 24', paths: ['M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'], color: 'var(--text-2)', bg: 'var(--bg-subtle)' }
}

export default function NotifikacijePage() {
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [myMemberId, setMyMemberId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const myMemberIdRef = useRef<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      currentUserIdRef.current = user.id
      setCurrentUserId(user.id)

      const [{ data: member }, { data: hm }] = await Promise.all([
        supabase.from('members').select('id').eq('user_id', user.id).single(),
        supabase.from('household_members').select('household_id').eq('user_id', user.id).single(),
      ])

      if (member) {
        myMemberIdRef.current = member.id
        setMyMemberId(member.id)
      }
      const hid = hm?.household_id ?? null
      if (hid) setHouseholdId(hid)

      if (!hid) { setLoading(false); return }

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('household_id', hid)
        .order('created_at', { ascending: false })
        .limit(100)

      setNotifications(notifs ?? [])
      setLoading(false)

      supabase.rpc('mark_all_notifications_read', { p_user_id: user.id }).then(() => {})
    }
    load()
  }, [])

  useEffect(() => {
    if (!householdId) return

    const channel = supabase
      .channel(`notifs-page-${householdId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `household_id=eq.${householdId}`,
      }, async (payload: any) => {
        const notif = payload.new as Notif
        setNotifications(prev => [{ ...notif, read_by: notif.read_by ?? [] }, ...prev])

        const uid = currentUserIdRef.current
        if (uid) {
          await supabase.rpc('mark_notification_read', { p_notification_id: notif.id, p_user_id: uid })
          setNotifications(prev => prev.map(n =>
            n.id === notif.id ? { ...n, read_by: [...(n.read_by ?? []), uid] } : n
          ))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId])

  async function markAllRead() {
    if (!currentUserId) return
    await supabase.rpc('mark_all_notifications_read', { p_user_id: currentUserId })
    setNotifications(prev => prev.map(n => ({
      ...n,
      read_by: n.read_by?.includes(currentUserId) ? n.read_by : [...(n.read_by ?? []), currentUserId],
    })))
  }

  async function toggleRead(notif: Notif) {
    if (!currentUserId) return
    const isRead = (notif.read_by ?? []).includes(currentUserId)
    if (isRead) {
      await supabase.rpc('mark_notification_unread', { p_notification_id: notif.id, p_user_id: currentUserId })
      setNotifications(prev => prev.map(n => n.id === notif.id
        ? { ...n, read_by: (n.read_by ?? []).filter(id => id !== currentUserId) }
        : n
      ))
    } else {
      await supabase.rpc('mark_notification_read', { p_notification_id: notif.id, p_user_id: currentUserId })
      setNotifications(prev => prev.map(n => n.id === notif.id
        ? { ...n, read_by: [...(n.read_by ?? []), currentUserId] }
        : n
      ))
    }
  }

  const groups = groupByDate(notifications)
  const hasUnread = notifications.some(n =>
    !(n.read_by ?? []).includes(currentUserId ?? '') &&
    n.triggered_by_member_id !== myMemberId
  )

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 22, fontWeight: 500, color: 'var(--header-text)' }}>Notifikacije</p>
          {hasUnread && (
            <button
              onClick={markAllRead}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'rgba(255,255,255,0.7)', padding: '4px 0',
              }}
            >
              Označi sve kao pročitano
            </button>
          )}
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
                    const isRead = (n.read_by ?? []).includes(currentUserId ?? '')
                    const unread = !isRead && n.triggered_by_member_id !== myMemberId
                    return (
                      <SwipeActions
                        key={n.id}
                        actions={[{
                          label: isRead ? 'Nepročitano' : 'Pročitano',
                          color: 'neutral',
                          onClick: () => toggleRead(n),
                        }]}
                      >
                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
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
                            <svg width="16" height="16" viewBox={icon.viewBox}
                              fill={icon.isFill ? icon.color : 'none'}
                              stroke={icon.isFill ? 'none' : icon.color}
                              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              {icon.paths.map((d, i) => <path key={i} d={d} />)}
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{n.title}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{n.body}</p>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginLeft: 4, paddingTop: 2 }}>{timeAgo(n.created_at)}</p>
                        </div>
                      </SwipeActions>
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
