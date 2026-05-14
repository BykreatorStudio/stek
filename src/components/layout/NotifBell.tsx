'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function NotifBell() {
  const [count, setCount] = useState(0)
  const memberIdRef = useRef<string | null>(null)
  usePushSubscription()

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let mounted = true
    let removeListener: (() => void) | undefined

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return

      const [{ data: member }, { data: hm }] = await Promise.all([
        supabase.from('members').select('id').eq('user_id', user.id).single(),
        supabase.from('household_members').select('household_id').eq('user_id', user.id).single(),
      ])
      if (!mounted) return

      memberIdRef.current = member?.id ?? null
      const userId = user.id
      const memberId = member?.id ?? null
      const householdId = hm?.household_id ?? null

      async function refreshCount() {
        if (!householdId) { if (mounted) setCount(0); return }
        let q = supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .not('read_by', 'cs', `{${userId}}`)
        if (memberId) q = q.or(`triggered_by_member_id.is.null,triggered_by_member_id.neq.${memberId}`)
        const { count: c } = await q
        if (mounted) setCount(c ?? 0)
      }

      await refreshCount()

      const handleFocus = () => refreshCount()
      window.addEventListener('focus', handleFocus)
      removeListener = () => window.removeEventListener('focus', handleFocus)

      if (!householdId) return

      channel = supabase
        .channel(`bell-${householdId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `household_id=eq.${householdId}`,
        }, (payload: any) => {
          if (!mounted) return
          if (payload.new.triggered_by_member_id !== memberIdRef.current) {
            setCount(c => c + 1)
          }
        })
        .subscribe()
    }

    setup()

    return () => {
      mounted = false
      removeListener?.()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return (
    <Link href="/notifikacije" style={{
      position: 'relative',
      width: 36, height: 36, borderRadius: '50%',
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textDecoration: 'none', flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 8, height: 8, borderRadius: '50%',
          background: '#f87171',
          border: '1.5px solid var(--header-bg)',
        }} />
      )}
    </Link>
  )
}
