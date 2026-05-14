'use client'

import { useState } from 'react'
import Select from '@/components/ui/Select'

type UpitType = 'Bug prijava' | 'Sugestija' | 'Pitanje' | 'Ostalo'

const UPIT_OPTIONS = [
  { value: 'Pitanje', label: 'Pitanje' },
  { value: 'Bug prijava', label: 'Bug prijava' },
  { value: 'Sugestija', label: 'Sugestija' },
  { value: 'Ostalo', label: 'Ostalo' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14,
  color: 'var(--text-1)', border: '1.5px solid var(--border)',
  borderRadius: 12, background: 'var(--card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

export default function ContactSection() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<UpitType>('Pitanje')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, type, message }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        setError('Greška pri slanju. Pokušaj ponovo.')
      }
    } catch {
      setError('Greška pri slanju. Pokušaj ponovo.')
    }
    setLoading(false)
  }

  function close() {
    setOpen(false)
    if (sent) {
      setName(''); setEmail(''); setType('Pitanje'); setMessage('')
      setSent(false)
    }
    setError('')
  }

  return (
    <>
      <div
        className="card"
        style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'rgba(99,102,241,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>Kontaktirajte nas</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>Bug, sugestija ili pitanje — tu smo</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text-1)',
            padding: '8px 14px', borderRadius: 10,
            border: '1.5px solid var(--border)', background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          Pišite nam
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={close}
        >
          <div
            style={{
              width: '100%', maxWidth: 540,
              background: 'var(--card)', borderRadius: '28px 28px 0 0',
              maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>

            {sent ? (
              <div style={{ padding: '20px 20px', paddingBottom: 'calc(36px + var(--safe-bottom))', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--accent-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '8px auto 18px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Poruka poslata!</p>
                <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>Hvala! Javićemo se uskoro.</p>
                <button onClick={close} className="btn-primary">Zatvori</button>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', padding: '4px 20px', paddingBottom: 'calc(32px + var(--safe-bottom))' }}>
                <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>Pišite nam</p>

                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Ime</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Vaše ime"
                  style={{ ...inputStyle, marginBottom: 14 }}
                />

                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vas@email.com"
                  style={{ ...inputStyle, marginBottom: 14 }}
                />

                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Vrsta upita</p>
                <Select
                  value={type}
                  onChange={v => setType(v as UpitType)}
                  options={UPIT_OPTIONS}
                  style={{ marginBottom: 14 }}
                />

                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Poruka</p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Opišite vaš bug, sugestiju ili pitanje..."
                  rows={5}
                  style={{ ...inputStyle, marginBottom: 16, resize: 'vertical', lineHeight: 1.5 }}
                />

                {error && (
                  <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || !name.trim() || !email.trim() || !message.trim()}
                  className="btn-primary"
                >
                  {loading ? 'Slanje...' : 'Pošalji poruku'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
