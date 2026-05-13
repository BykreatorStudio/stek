'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLogoSection } from '@/components/ui/AuthLogo'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function RegisterPage() {
  const [mode, setMode] = useState<'novi' | 'pridruzi'>('novi')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Unesi ime.'); return }
    if (mode === 'pridruzi' && !inviteCode.trim()) { setError('Unesi pozivni kod.'); return }
    setLoading(true); setError('')
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (!data.user) { setError('Registracija nije uspela.'); setLoading(false); return }

    if (mode === 'novi') {
      const code = generateCode()
      const { error: rpcError } = await supabase.rpc('create_household', {
        p_invite_code: code,
        p_name: name.trim(),
        p_user_id: data.user.id,
      })
      if (rpcError) { setError(rpcError.message); setLoading(false); return }
    } else {
      const { error: rpcError } = await supabase.rpc('join_household', {
        p_email: email.trim(),
        p_code: inviteCode.trim().toUpperCase(),
        p_name: name.trim(),
        p_user_id: data.user.id,
      })
      if (rpcError) {
        setError(rpcError.message.includes('invalid_code') ? 'Pogrešan pozivni kod.' : rpcError.message)
        setLoading(false); return
      }
    }

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
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-subtle)', borderRadius: 12, padding: 4 }}>
          {(['novi', 'pridruzi'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: mode === m ? '#ffffff' : 'transparent',
                color: mode === m ? '#100F0D' : 'var(--text-3)',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {m === 'novi' ? 'Novi nalog' : 'Pridruži se'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ime" className="input" autoFocus />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="Email adresa" className="input" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="Lozinka" className="input" />
          {mode === 'pridruzi' && (
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} required placeholder="Pozivni kod" className="input" />
          )}
          {mode === 'pridruzi' && <p style={{ fontSize: 12, color: 'var(--text-3)', paddingLeft: 4, marginTop: -4 }}>Koristi isti email na koji je kod poslat</p>}
          {error && <p style={{ fontSize: 13, color: 'var(--red)', paddingLeft: 4 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
            {loading ? 'Kreiranje...' : mode === 'novi' ? 'Kreiraj nalog' : 'Pridruži se'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', paddingTop: 4 }}>
            Već imam nalog?{' '}
            <Link href="/login" style={{ color: 'var(--text-1)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Prijavi se
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
