'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeRefresher({ householdId }: { householdId: string }) {
  const router = useRouter()
  const memberIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id').eq('user_id', user.id).single()
        .then(({ data }) => { memberIdRef.current = data?.id ?? null })
    })

    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => router.refresh(), 800)
    }

    const channel = supabase
      .channel(`refresh-${householdId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `household_id=eq.${householdId}`,
      }, (payload: any) => {
        if (payload.new.triggered_by_member_id !== memberIdRef.current) {
          scheduleRefresh()
        }
      })
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [householdId])

  return null
}
