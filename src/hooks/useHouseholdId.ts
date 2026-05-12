'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useHouseholdId(): string | null {
  const [householdId, setHouseholdId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('household_members').select('household_id').limit(1)
      .then(({ data }) => { if (data?.[0]) setHouseholdId(data[0].household_id) })
  }, [])

  return householdId
}
