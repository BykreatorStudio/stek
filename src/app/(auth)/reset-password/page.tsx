'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLogoSection } from '@/components/ui/AuthLogo'
import { Suspense } from 'react'

function ResetPasswordInner() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError('Link za reset lozinke je istekao ili je već iskorišćen. Zatražite novi.')
        }
        setExchanging(false)
      })
    } else {
      router.replace('/forgot-password')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setExchanging(false)
        setError('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const match = password.length >= 6 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!match) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 2000)
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(200,255,49,0.28) 0%, #ffffff 65%)',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px 32px' }}>
        <AuthLogoSection />
      </div>

      <div style={{
        background: '#ffffff',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px',
        paddingBottom: 'calc(28px + var(--safe-bottom))',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06)',
      }}>
        {done ? (
          <>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 8 }}>Lozinka promenjena</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Bićete preusmereni na početnu...</p>
          </>
        ) : exchanging ? (
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Proveravamo link...</p>
        ) : error && !password ? (
          <>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 8 }}>Link nije validan</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>{error}</p>
            <button
              onClick={() => router.push('/forgot-password')}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Zatraži novi link
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 20 }}>Nova lozinka</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Nova lozinka (min. 6 znakova)"
                className="input"
              />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Ponovite lozinku"
                className="input"
              />
              {error && <p style={{ fontSize: 13, color: 'var(--red)', paddingLeft: 4 }}>{error}</p>}
              {confirm.length > 0 && !match && (
                <p style={{ fontSize: 13, color: 'var(--red)', paddingLeft: 4 }}>Lozinke se ne poklapaju</p>
              )}
              <button type="submit" disabled={loading || !match} className="btn-primary" style={{ marginTop: 4 }}>
                {loading ? 'Čuvanje...' : 'Sačuvaj lozinku'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  )
}
