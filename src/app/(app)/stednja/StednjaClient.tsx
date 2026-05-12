'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CalendarPopup from '@/components/ui/CalendarPopup'
import AmountInput, { parseAmount } from '@/components/ui/AmountInput'
import { useHouseholdId } from '@/hooks/useHouseholdId'
import { notifyHousehold } from '@/lib/notify'

type Member = { id: string; name: string; color: string }
type Saving = { id: string; amount: number; currency: string; date: string; note: string | null; member?: Member | null }

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDate(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function AddModal({ type, balance, onClose }: { type: 'uplata' | 'isplata'; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [view, setView] = useState<'form' | 'calendar'>('form')
  const [currentMember, setCurrentMember] = useState<{ id: string; name: string } | null>(null)
  const householdId = useHouseholdId()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, name').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
  }, [])

  async function handleSave() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    if (type === 'isplata' && a > balance) {
      setErrMsg(`Nema dovoljno u sefu. Trenutno stanje: ${new Intl.NumberFormat('sr-Latn-RS').format(Math.round(balance))} RSD`)
      return
    }
    setErrMsg('')
    if (!householdId) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('savings').insert({
      household_id: householdId,
      amount: type === 'uplata' ? a : -a,
      currency: 'RSD', date,
      note: note.trim() || null,
      member_id: currentMember?.id ?? null,
    })
    await supabase.from('transactions').insert({
      household_id: householdId,
      bucket_id: null, category_id: null,
      user_id: user!.id,
      type: type === 'uplata' ? 'rashod' : 'prihod',
      amount: a, currency: 'RSD', date,
      month: date.slice(0, 7),
      name: type === 'uplata' ? 'Uplata u sef' : 'Isplata iz sefa',
      note: note.trim() || null,
      member_id: currentMember?.id ?? null,
    })
    const fmt = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    const memberName = currentMember?.name ?? 'Neko'
    notifyHousehold({
      householdId,
      triggeredByMemberId: currentMember?.id,
      type: type === 'uplata' ? 'sef_uplata' : 'sef_isplata',
      title: memberName,
      body: type === 'uplata'
        ? `Uplata u sef · ${fmt(a)} RSD`
        : `Isplata iz sefa · ${fmt(a)} RSD`,
    })
    setLoading(false); onClose(); router.refresh()
  }

  const color = type === 'uplata' ? 'var(--accent)' : 'var(--red)'
  const label = type === 'uplata' ? 'Uplata u sef' : 'Isplata iz sefa'

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
          width: '100%', maxWidth: 540, background: 'var(--card)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>Datum</span>
            </div>
            <CalendarPopup value={date} onChange={v => { setDate(v); setView('form') }} onClose={() => setView('form')} inline />
          </div>
        ) : (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 16, fontWeight: 500, color, marginBottom: 24 }}>{label}</p>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <AmountInput
                value={amount}
                onChange={setAmount}
                placeholder="0"
                autoFocus
                className="num"
                style={{
                  fontSize: 52, fontWeight: 500, color: 'var(--text-1)',
                  border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'inherit', width: '100%', textAlign: 'center',
                }}
              />
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>RSD</p>
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
                outline: 'none', fontFamily: 'inherit', marginBottom: 10,
              }}
            />

            {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10, textAlign: 'center' }}>{errMsg}</p>}
            <button onClick={handleSave} disabled={loading || !amount} className="btn-primary">
              {loading ? 'Čuvanje...' : label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StednjaClient({ savings, balance }: { savings: Saving[]; balance: number }) {
  const [modal, setModal] = useState<'uplata' | 'isplata' | null>(null)

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={() => setModal('uplata')}
          style={{
            flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--accent-light)', color: 'var(--accent-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Uplata
        </button>
        <button
          onClick={() => setModal('isplata')}
          style={{
            flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--red-light)', color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Isplata
        </button>
      </div>

      {/* History */}
      {savings.length === 0 ? (
        <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Sef je prazan. Dodaj prvu uplatu.</p>
        </div>
      ) : (
        <>
          <p className="section-label">Istorija</p>
          <div className="card" style={{ overflow: 'hidden' }}>
            {savings.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < savings.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 2 }}>{fmtDate(s.date)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {s.member?.name ?? ''}
                    {s.note ? (s.member?.name ? ` · ${s.note}` : s.note) : ''}
                  </p>
                </div>
                <p className="num" style={{
                  fontSize: 15, fontWeight: 500,
                  color: s.amount >= 0 ? 'var(--accent)' : 'var(--red)',
                }}>
                  {s.amount >= 0 ? '+' : '-'}{fmt(s.amount)}
                  <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && <AddModal type={modal} balance={balance} onClose={() => setModal(null)} />}
    </>
  )
}
