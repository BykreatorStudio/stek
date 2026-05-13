'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CalendarPopup from '@/components/ui/CalendarPopup'
import AmountInput, { parseAmount } from '@/components/ui/AmountInput'
import { notifyHousehold } from '@/lib/notify'
import SwipeActions from '@/components/ui/SwipeActions'

type Member = { id: string; name: string; color: string }
type Saving = { id: string; amount: number; currency: string; date: string; note: string | null; member?: Member | null }
type Sef = { id: string; name: string; household_id: string; created_at: string; items: Saving[]; balance: number }

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDate(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function CreateSefModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: hm } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!hm?.household_id) { setLoading(false); return }
    await supabase.from('sefovi').insert({ name: name.trim(), household_id: hm.household_id })
    setLoading(false)
    onClose()
    router.refresh()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>
        <div style={{ padding: '8px 20px', paddingBottom: 'calc(32px + var(--safe-bottom))' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>Novi sef</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Naziv (npr. More, Vikendica...)"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              width: '100%', padding: '13px 16px', fontSize: 14,
              color: 'var(--text-1)', border: '1.5px solid var(--border)',
              borderRadius: 12, background: 'var(--card)',
              outline: 'none', fontFamily: 'inherit', marginBottom: 16,
            }}
          />
          <button onClick={handleSave} disabled={loading || !name.trim()} className="btn-primary">
            {loading ? 'Čuvanje...' : 'Kreiraj sef'}
          </button>
        </div>
      </div>
    </div>
  )
}

type View = 'detail' | 'uplata' | 'isplata' | 'calendar'

function SefDetailSheet({ sef, onClose }: { sef: Sef; onClose: () => void }) {
  const [view, setView] = useState<View>('detail')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [currentMember, setCurrentMember] = useState<{ id: string; name: string } | null>(null)
  const callerView = useRef<'uplata' | 'isplata'>('uplata')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, name').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
  }, [])

  function goToCalendar(from: 'uplata' | 'isplata') {
    callerView.current = from
    setView('calendar')
  }

  async function handleTransaction(type: 'uplata' | 'isplata') {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    if (type === 'isplata' && a > sef.balance) {
      setErrMsg(`Nema dovoljno u sefu. Stanje: ${fmt(sef.balance)} RSD`)
      return
    }
    setErrMsg('')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('savings').insert({
      sef_id: sef.id,
      amount: type === 'uplata' ? a : -a,
      currency: 'RSD', date,
      note: note.trim() || null,
      member_id: currentMember?.id ?? null,
    })
    await supabase.from('transactions').insert({
      bucket_id: null, category_id: null,
      user_id: user!.id,
      type: type === 'uplata' ? 'rashod' : 'prihod',
      amount: a, currency: 'RSD', date,
      month: date.slice(0, 7),
      name: type === 'uplata' ? `Uplata u sef · ${sef.name}` : `Isplata iz sefa · ${sef.name}`,
      note: note.trim() || null,
    })
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: type === 'uplata' ? 'sef_uplata' : 'sef_isplata',
      title: type === 'uplata' ? 'Uplata u sef' : 'Isplata iz sefa',
      body: `${sef.name} · ${currentMember?.name ?? 'Neko'} · ${fmtN(a)} RSD`,
    })
    setLoading(false)
    setAmount(''); setNote(''); setErrMsg('')
    setView('detail')
    router.refresh()
  }

  const transColor = view === 'uplata' ? 'var(--accent)' : 'var(--red)'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        {view === 'calendar' ? (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setView(callerView.current)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>Datum</span>
            </div>
            <CalendarPopup
              value={date}
              onChange={v => { setDate(v); setView(callerView.current) }}
              onClose={() => setView(callerView.current)}
              inline
            />
          </div>

        ) : view === 'uplata' || view === 'isplata' ? (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => { setView('detail'); setAmount(''); setNote(''); setErrMsg('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: transColor }}>
                {view === 'uplata' ? 'Uplata u sef' : 'Isplata iz sefa'}
              </span>
            </div>

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
              onClick={() => goToCalendar(view)}
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
            <button onClick={() => handleTransaction(view)} disabled={loading || !amount} className="btn-primary">
              {loading ? 'Čuvanje...' : view === 'uplata' ? 'Uplata' : 'Isplata'}
            </button>
          </div>

        ) : (
          <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{sef.name}</p>
            <p className="num" style={{
              fontSize: 32, fontWeight: 500, marginBottom: 20,
              color: sef.balance > 0 ? 'var(--accent)' : sef.balance < 0 ? 'var(--red)' : 'var(--text-3)',
            }}>
              {sef.items.length > 0 ? fmt(sef.balance) : '—'}
              {sef.items.length > 0 && <span style={{ fontSize: 15, fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>RSD</span>}
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                onClick={() => setView('uplata')}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: 'var(--accent-light)', color: 'var(--accent-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Uplata
              </button>
              <button
                onClick={() => setView('isplata')}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: 'var(--red-light)', color: 'var(--red)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Isplata
              </button>
            </div>

            {sef.items.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                Sef je prazan. Dodaj prvu uplatu.
              </p>
            ) : (
              <>
                <p className="section-label">Istorija</p>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {[...sef.items].sort((a, b) => b.date.localeCompare(a.date)).map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < sef.items.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div>
                        <p style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 2 }}>{fmtDate(s.date)}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {s.member?.name ?? ''}
                          {s.note ? (s.member?.name ? ` · ${s.note}` : s.note) : ''}
                        </p>
                      </div>
                      <p className="num" style={{ fontSize: 15, fontWeight: 500, color: s.amount >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                        {s.amount >= 0 ? '+' : '-'}{fmt(s.amount)}
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StednjaClient({ sefovi }: { sefovi: Sef[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Sef | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const selected = selectedId ? sefovi.find(s => s.id === selectedId) ?? null : null

  async function deleteSef(sef: Sef) {
    await supabase.from('sefovi').delete().eq('id', sef.id)
    setConfirmDelete(null)
    setSelectedId(null)
    router.refresh()
  }

  return (
    <>
      {sefovi.length === 0 ? (
        <div className="card" style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema sefova. Kreiraj prvi sef.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sefovi.map(sef => (
            <SwipeActions
              key={sef.id}
              onTap={() => setSelectedId(sef.id)}
              tapLabel="Otvori"
              actions={[{ label: 'Obriši', color: 'danger', onClick: () => setConfirmDelete(sef) }]}
            >
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{sef.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {sef.items.length === 0
                      ? 'Prazan'
                      : `${sef.items.length} ${sef.items.length === 1 ? 'stavka' : sef.items.length < 5 ? 'stavke' : 'stavki'}`}
                  </p>
                </div>
                <p className="num" style={{
                  fontSize: 18, fontWeight: 500,
                  color: sef.balance > 0 ? 'var(--accent)' : sef.balance < 0 ? 'var(--red)' : 'var(--text-3)',
                }}>
                  {sef.items.length > 0 ? fmt(sef.balance) : '—'}
                  {sef.items.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
                </p>
              </div>
            </SwipeActions>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        style={{
          position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)', right: 20,
          width: 52, height: 52, borderRadius: 16,
          background: 'var(--text-1)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {selected && <SefDetailSheet sef={selected} onClose={() => setSelectedId(null)} />}
      {showCreate && <CreateSefModal onClose={() => setShowCreate(false)} />}

      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši sef?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              {confirmDelete.items.length > 0
                ? `Sef "${confirmDelete.name}" i sve uplate biće trajno obrisane.`
                : `Sef "${confirmDelete.name}" biće trajno obrisan.`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Otkaži</button>
              <button onClick={() => deleteSef(confirmDelete)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
