'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CalendarPopup from '@/components/ui/CalendarPopup'
import { useHouseholdId } from '@/hooks/useHouseholdId'
import { notifyHousehold } from '@/lib/notify'

const CEK_VALUE = 5000

function today() { return new Date().toISOString().split('T')[0] }

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(n)
}

function fmtDate(v: string) {
  if (!v) return ''
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CekForm({ onClose }: { onClose: () => void }) {
  const [qty, setQty] = useState('1')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'form' | 'calendar'>('form')
  const [currentMember, setCurrentMember] = useState<{ id: string; name: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const householdId = useHouseholdId()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, name').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
  }, [])

  async function handleSubmit() {
    const q = parseInt(qty)
    if (!q || q < 1 || !date) return
    setLoading(true)
    const { error } = await supabase.from('checks').insert({
      quantity: q, date,
      month: date.slice(0, 7),
      note: note.trim() || null,
      status: 'na_cekanju',
    })
    setLoading(false)
    if (error) return
    if (householdId) {
      const total = q * CEK_VALUE
      const fmt = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(n)
      notifyHousehold({
        householdId,
        triggeredByMemberId: currentMember?.id,
        type: 'cek',
        title: currentMember?.name ?? 'Neko',
        body: `Dodat ${q === 1 ? 'ček' : `${q} čeka`} · ${fmt(total)} RSD`,
      })
    }
    onClose()
    router.refresh()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--card)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        {view === 'calendar' ? (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setView('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>Datum naplate</span>
            </div>
            <CalendarPopup
              value={date}
              onChange={v => { setDate(v); setView('form') }}
              onClose={() => setView('form')}
              inline
            />
          </div>
        ) : (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 24 }}>Dodaj čekove</p>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Broj čekova</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <button
                  onClick={() => setQty(v => String(Math.max(1, parseInt(v || '1') - 1)))}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-subtle)', border: 'none', cursor: 'pointer',
                    color: 'var(--text-1)',
                  }}
                >−</button>
                <div style={{ textAlign: 'center' }}>
                  <p className="num" style={{ fontSize: 48, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1 }}>{qty}</p>
                  <p className="num" style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                    = {fmt(parseInt(qty || '1') * CEK_VALUE)} RSD
                  </p>
                </div>
                <button
                  onClick={() => setQty(v => String(parseInt(v || '1') + 1))}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-subtle)', border: 'none', cursor: 'pointer',
                    color: 'var(--text-1)',
                  }}
                >+</button>
              </div>
            </div>

            <button
              onClick={() => setView('calendar')}
              style={{
                width: '100%', padding: '13px 16px', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '1.5px solid var(--border)', borderRadius: 12,
                background: 'var(--card)', cursor: 'pointer',
                fontSize: 14, color: 'var(--text-1)', fontFamily: 'inherit',
              }}
            >
              <span>{fmtDate(date)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>

            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Napomena (opciono)"
              style={{
                width: '100%', padding: '13px 16px', fontSize: 14,
                color: 'var(--text-1)', border: '1.5px solid var(--border)',
                borderRadius: 12, background: 'var(--card)',
                outline: 'none', fontFamily: 'inherit', marginBottom: 20,
              }}
            />

            <button onClick={handleSubmit} disabled={loading || !qty || parseInt(qty) < 1} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Dodaj'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
