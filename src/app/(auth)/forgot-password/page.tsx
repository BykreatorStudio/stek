'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthLogoSection } from '@/components/ui/AuthLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('rate') || msg.includes('after')) {
        setError('Već smo ti poslali link. Sačekaj nekoliko minuta pa pokušaj ponovo.')
      } else {
        setError('Greška pri slanju. Pokušaj ponovo.')
      }
      return
    }
    setSent(true)
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
        {sent ? (
          <>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 10 }}>Proveri email</p>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 }}>
              Poslali smo link za reset lozinke na <strong>{email}</strong>. Klikni na link u mejlu da postaviš novu lozinku.
            </p>
            <Link href="/login" style={{ display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text-1)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Nazad na prijavu
            </Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#100F0D', marginBottom: 6 }}>Zaboravljena lozinka</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Unesite email adresu i poslat ćemo vam link za reset.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Email adresa"
                className="input"
              />
              {error && <p style={{ fontSize: 13, color: 'var(--red)', paddingLeft: 4 }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
                {loading ? 'Slanje...' : 'Pošalji link'}
              </button>
              <Link href="/login" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', paddingTop: 4 }}>
                Nazad na prijavu
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
