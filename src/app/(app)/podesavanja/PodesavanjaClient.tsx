'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Prefs = {
  notif_enabled: boolean
  notif_bills: boolean
  notif_pozajmice: boolean
  notif_cekovi: boolean
  notif_ostalo: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none',
        background: checked ? 'var(--accent-brand)' : 'var(--border-2)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
      <div>
        <p style={{ fontSize: 14, color: 'var(--text-1)' }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 20px' }} />
}

function DeleteAccountModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const emailMatch = email.trim().toLowerCase() === userEmail.toLowerCase()

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/delete-account', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Greška pri brisanju naloga')
      setLoading(false)
      return
    }
    router.push('/login')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: '0 24px' }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 24, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši nalog?</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
          Vaš pristup biće trajno uklonjen. Finansijski podaci ostaju u sistemu. Ova akcija se ne može vratiti.
        </p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Unesite vaš email za potvrdu"
          style={{
            width: '100%', padding: '13px 16px', fontSize: 14,
            color: 'var(--text-1)', border: '1.5px solid var(--border)',
            borderRadius: 12, background: 'var(--bg-subtle)',
            outline: 'none', fontFamily: 'inherit', marginBottom: 12,
          }}
        />
        {error && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, border: '1.5px solid var(--border-2)', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit' }}>
            Otkaži
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || !emailMatch}
            style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: 'none', background: emailMatch ? 'var(--red)' : 'var(--border-2)', cursor: emailMatch ? 'pointer' : 'default', color: emailMatch ? '#fff' : 'var(--text-3)', fontFamily: 'inherit', transition: 'background 0.15s' }}
          >
            {loading ? 'Brisanje...' : 'Obriši'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PodesavanjaClient({ userEmail, initialPrefs }: { userEmail: string; initialPrefs: Prefs }) {
  const [prefs, setPrefs] = useState(initialPrefs)
  const [resetSent, setResetSent] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const supabase = createClient()

  async function updatePref(key: keyof Prefs, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('household_members').update({ [key]: value }).eq('user_id', user.id)
  }

  async function handleResetPassword() {
    await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setResetSent(true)
  }

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        <p className="section-label">Notifikacije</p>
        <div style={{ background: 'var(--card)', borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
          <ToggleRow
            label="Push notifikacije"
            sub="Master prekidač za sve"
            checked={prefs.notif_enabled}
            onChange={() => updatePref('notif_enabled', !prefs.notif_enabled)}
          />
          <Divider />
          <div style={{ opacity: prefs.notif_enabled ? 1 : 0.4, pointerEvents: prefs.notif_enabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <ToggleRow
              label="Računi i krediti"
              checked={prefs.notif_bills}
              onChange={() => updatePref('notif_bills', !prefs.notif_bills)}
            />
            <Divider />
            <ToggleRow
              label="Pozajmice"
              checked={prefs.notif_pozajmice}
              onChange={() => updatePref('notif_pozajmice', !prefs.notif_pozajmice)}
            />
            <Divider />
            <ToggleRow
              label="Čekovi"
              checked={prefs.notif_cekovi}
              onChange={() => updatePref('notif_cekovi', !prefs.notif_cekovi)}
            />
            <Divider />
            <ToggleRow
              label="Ostalo"
              sub="Transakcije, štednja i sl."
              checked={prefs.notif_ostalo}
              onChange={() => updatePref('notif_ostalo', !prefs.notif_ostalo)}
            />
          </div>
        </div>

        <p className="section-label">Nalog</p>
        <div style={{ background: 'var(--card)', borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 20px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Email</p>
            <p style={{ fontSize: 14, color: 'var(--text-1)' }}>{userEmail}</p>
          </div>
          <Divider />
          <button
            onClick={handleResetPassword}
            disabled={resetSent}
            style={{ width: '100%', padding: '14px 20px', textAlign: 'left', fontSize: 14, color: resetSent ? 'var(--text-3)' : 'var(--text-1)', background: 'none', border: 'none', cursor: resetSent ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {resetSent ? 'Link je poslat na vaš email' : 'Promeni lozinku'}
          </button>
        </div>

        <p className="section-label">Opasna zona</p>
        <div style={{ background: 'var(--card)', borderRadius: 18, overflow: 'hidden' }}>
          <button
            onClick={() => setShowDelete(true)}
            style={{ width: '100%', padding: '14px 20px', textAlign: 'left', fontSize: 14, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Obriši nalog
          </button>
        </div>

      </div>

      {showDelete && <DeleteAccountModal userEmail={userEmail} onClose={() => setShowDelete(false)} />}
    </>
  )
}
