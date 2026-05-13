'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLogoSection } from '@/components/ui/AuthLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Pogrešan email ili lozinka.'); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
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
        <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 20 }}>Prijava</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="Email adresa"
            className="input"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Lozinka"
            className="input"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: -4 }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Zaboravljena lozinka?
            </Link>
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--red)', paddingLeft: 4 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', paddingTop: 4 }}>
            Nemaš nalog?{' '}
            <Link href="/register" style={{ color: 'var(--text-1)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Registruj se
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
