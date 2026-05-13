'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AuthLogoSection } from '@/components/ui/AuthLogo'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
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
