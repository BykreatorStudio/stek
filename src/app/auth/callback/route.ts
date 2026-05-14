import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'
  const isRecovery = next === '/reset-password'

  const response = NextResponse.redirect(`${origin}/login`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    if (!error) {
      if (isRecovery) response.cookies.set('recovery-pending', '1', { httpOnly: false, sameSite: 'lax', path: '/' })
      response.headers.set('location', `${origin}${next}`)
      return response
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (isRecovery) response.cookies.set('recovery-pending', '1', { httpOnly: false, sameSite: 'lax', path: '/' })
      response.headers.set('location', `${origin}${next}`)
      return response
    }
  }

  return response
}
