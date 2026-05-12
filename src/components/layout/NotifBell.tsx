'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function NotifBell() {
  const [count, setCount] = useState(0)
  const supabase = createClient()
  usePushSubscription()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_my_unread_notification_count')
      setCount(data ?? 0)
    }
    load()

    const handleFocus = () => load()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
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
