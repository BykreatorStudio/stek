import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  let eurToRsd: number
  try {
    const res = await fetch(
      `https://kurs.resenje.org/api/v1/currencies/eur/rates/today`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    const data = await res.json()
    eurToRsd = data.exchange_middle
    if (!eurToRsd) throw new Error('exchange_middle missing in response')
  } catch (err: any) {
    return NextResponse.json({ error: `Fetch failed: ${err.message}` }, { status: 502 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('nbs_rates')
    .upsert({ date: today, eur_to_rsd: eurToRsd }, { onConflict: 'date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, date: today, eur_to_rsd: eurToRsd })
}
