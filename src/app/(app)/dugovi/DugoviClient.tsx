'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { notifyHousehold } from '@/lib/notify'
import CalendarPopup from '@/components/ui/CalendarPopup'
import Select from '@/components/ui/Select'
import AmountInput, { parseAmount } from '@/components/ui/AmountInput'
import SwipeActions from '@/components/ui/SwipeActions'
import EditAmountSheet from '@/components/ui/EditAmountSheet'

type Payment = { id: string; amount: number; currency: string; date: string; note: string | null; member?: { name: string } | null }
type Debt = {
  id: string; direction: 'dugujemo' | 'duguju_nam'; name: string
  total_amount: number; currency: string; start_date: string | null; note: string | null
  status: 'aktivno' | 'izmireno'
  payments: Payment[]; paid: number; remaining: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDate(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function DateButton({ value, onClick, onClear }: { value: string; onClick: () => void; onClear?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 16px', marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1.5px solid var(--border)', borderRadius: 12,
        background: 'var(--card)', cursor: 'pointer',
        fontSize: 14, fontFamily: 'inherit',
        color: value ? 'var(--text-1)' : 'var(--text-3)',
      }}
    >
      <span>{value ? fmtDate(value) : 'Datum dospeća (opciono)'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {value && onClear && (
          <span onClick={e => { e.stopPropagation(); onClear() }} style={{ fontSize: 16, color: 'var(--text-3)', lineHeight: 1, padding: '0 2px' }}>×</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    </button>
  )
}

function CalendarView({ title, value, onChange, onBack }: { title: string; value: string; onChange: (v: string) => void; onBack: () => void }) {
  return (
    <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>{title}</span>
      </div>
      <CalendarPopup value={value} onChange={v => { onChange(v); onBack() }} onClose={onBack} inline />
    </div>
  )
}

function DebtModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'main' | 'calendar'>('main')
  const [confirmSettle, setConfirmSettle] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [currentMember, setCurrentMember] = useState<{ id: string; name: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, name').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
  }, [])

  const isSettled = debt.status === 'izmireno'
  const pct = Math.min(100, debt.total_amount > 0 ? (debt.paid / debt.total_amount) * 100 : 0)

  async function addPayment() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    setLoading(true)
    const { error } = await supabase.from('debt_payments').insert({
      debt_id: debt.id, amount: a, currency: debt.currency,
      date, note: note.trim() || null,
    })
    if (error) { setErrMsg(error.message); setLoading(false); return }

    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    const memberName = currentMember?.name ?? 'Neko'
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: 'dug_placen',
      title: 'Uplata pozajmice',
      body: `${memberName} · ${debt.name} · ${fmtN(a)} ${debt.currency}`,
    })
    const newPaid = debt.paid + a
    if (newPaid >= debt.total_amount) {
      await supabase.from('dugovi').update({ status: 'izmireno' }).eq('id', debt.id)
      notifyHousehold({
        triggeredByMemberId: currentMember?.id,
        type: 'dug_izmiren',
        title: 'Pozajmica izmirena',
        body: `${debt.name}`,
      })
    }
    setLoading(false)
    setAmount(''); setNote(''); setErrMsg('')
    router.refresh()
  }

  async function markSettled() {
    await supabase.from('dugovi').update({ status: 'izmireno' }).eq('id', debt.id)
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: 'dug_izmiren',
      title: 'Pozajmica izmirena',
      body: `${debt.name}`,
    })
    setConfirmSettle(false)
    router.refresh()
  }

  return (
    <>
      {confirmSettle && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: '0 24px' }}
          onClick={() => setConfirmSettle(false)}
        >
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 24, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8, textAlign: 'center' }}>Označi kao izmiren</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, textAlign: 'center' }}>
              Pozajmica "{debt.name}" će biti označena kao izmirena.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmSettle(false)} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, border: '1.5px solid var(--border-2)', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit' }}>Otkaži</button>
              <button onClick={markSettled} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--text-1)', cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}>Potvrdi</button>
            </div>
          </div>
        </div>
      )}
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
            <CalendarView title="Datum uplate" value={date} onChange={setDate} onBack={() => setView('main')} />
          ) : (
            <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 17, fontWeight: 500, color: isSettled ? 'var(--text-3)' : 'var(--text-1)' }}>{debt.name}</p>
                {isSettled && (
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                    Izmireno
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                {debt.direction === 'dugujemo' ? 'Primljena pozajmica' : 'Data pozajmica'}
                {debt.start_date && ` · Do: ${fmtDate(debt.start_date)}`}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Vraćeno {fmt(debt.paid)} / {fmt(debt.total_amount)} {debt.currency}</span>
                <span className="num" style={{ fontSize: 13, fontWeight: 500, color: isSettled ? 'var(--accent)' : 'var(--text-1)' }}>
                  {isSettled ? 'Izmireno' : `Preostalo: ${fmt(debt.remaining)} ${debt.currency}`}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--border-2)', marginBottom: 20 }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  background: isSettled ? 'var(--accent)' : debt.direction === 'dugujemo' ? '#f87171' : 'var(--accent)',
                  width: `${pct}%`, transition: 'width 0.3s',
                }} />
              </div>

              {debt.payments.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p className="section-label">Istorija uplata</p>
                  <div className="card" style={{ overflow: 'hidden' }}>
                    {[...debt.payments].sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < debt.payments.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{fmtDate(p.date)}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {p.member?.name ?? ''}
                            {p.note ? (p.member?.name ? ` · ${p.note}` : p.note) : ''}
                          </p>
                        </div>
                        <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
                          +{fmt(p.amount)} {p.currency}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isSettled && (
                <>
                  <p className="section-label">Dodaj uplatu</p>
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="Iznos"
                    className="num"
                    style={{
                      width: '100%', padding: '13px 16px', fontSize: 14,
                      color: 'var(--text-1)', border: '1.5px solid var(--border)',
                      borderRadius: 12, background: 'var(--card)',
                      outline: 'none', fontFamily: 'inherit', marginBottom: 10,
                    }}
                  />
                  <DateButton value={date} onClick={() => setView('calendar')} />
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Napomena (opciono)"
                    style={{
                      width: '100%', padding: '13px 16px', fontSize: 14,
                      color: 'var(--text-1)', border: '1.5px solid var(--border)',
                      borderRadius: 12, background: 'var(--card)',
                      outline: 'none', fontFamily: 'inherit', marginBottom: 12,
                    }}
                  />
                  {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{errMsg}</p>}
                  <button onClick={addPayment} disabled={loading || !amount} className="btn-primary" style={{ marginBottom: 10 }}>
                    {loading ? 'Čuvanje...' : 'Dodaj uplatu'}
                  </button>
                  <button
                    onClick={() => setConfirmSettle(true)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 500,
                      border: '1.5px solid var(--border-2)', background: 'transparent',
                      cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit',
                    }}
                  >
                    Označi kao izmiren
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function AddDebtModal({ buckets, onClose }: { buckets: { id: string; name: string }[]; onClose: () => void }) {
  const [direction, setDirection] = useState<'dugujemo' | 'duguju_nam'>('dugujemo')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [view, setView] = useState<'form' | 'calendar'>('form')
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    const a = parseAmount(amount)
    if (!name.trim() || !a || a <= 0) { setErrMsg('Unesi naziv i iznos'); return }
    setErrMsg('')
    setLoading(true)
    const { error } = await supabase.from('dugovi').insert({
      direction, name: name.trim(), total_amount: a, bucket_id: bucketId || null,
      currency, start_date: date || null, note: note.trim() || null, status: 'aktivno',
    })
    setLoading(false)
    if (error) { setErrMsg(error.message); return }
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      type: 'dug_dodat',
      title: 'Nova pozajmica',
      body: `${direction === 'dugujemo' ? 'Dugujemo' : 'Duguju nam'}: ${name.trim()} · ${fmtN(a)} ${currency}`,
    })
    onClose(); router.refresh()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        {view === 'calendar' ? (
          <CalendarView title="Datum pozajmice" value={date} onChange={setDate} onBack={() => setView('form')} />
        ) : (
          <div style={{ overflowY: 'auto', padding: '8px 20px calc(32px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>Nova pozajmica</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {([
                { d: 'dugujemo' as const, label: 'Primljena pozajmica', desc: 'Treba da vratimo' },
                { d: 'duguju_nam' as const, label: 'Data pozajmica', desc: 'Treba da prime' },
              ]).map(({ d, label, desc }) => {
                const active = direction === d
                return (
                  <button key={d} onClick={() => setDirection(d)} style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                    border: `1.5px solid ${active ? 'var(--text-1)' : 'var(--border)'}`,
                    background: active ? 'var(--text-1)' : 'var(--card)', cursor: 'pointer',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: active ? '#fff' : 'var(--text-1)', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-3)' }}>{desc}</p>
                  </button>
                )
              })}
            </div>

            <Select
              value={bucketId}
              onChange={setBucketId}
              options={buckets.map(b => ({ label: b.name, value: b.id }))}
              style={{ marginBottom: 10 }}
            />

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={direction === 'dugujemo' ? 'Ime davaoca pozajmice' : 'Ime primaoca pozajmice'}
              style={{
                width: '100%', padding: '13px 16px', fontSize: 14,
                color: 'var(--text-1)', border: '1.5px solid var(--border)',
                borderRadius: 12, background: 'var(--card)',
                outline: 'none', fontFamily: 'inherit', marginBottom: 10,
              }}
            />

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <AmountInput
                value={amount}
                onChange={setAmount}
                placeholder="Iznos"
                className="num"
                style={{
                  flex: 1, padding: '13px 16px', fontSize: 14,
                  color: 'var(--text-1)', border: '1.5px solid var(--border)',
                  borderRadius: 12, background: 'var(--card)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(['RSD', 'EUR'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: currency === c ? 'var(--text-1)' : 'var(--border)',
                    background: currency === c ? 'var(--text-1)' : 'transparent',
                    color: currency === c ? '#fff' : 'var(--text-3)',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <DateButton value={date} onClick={() => setView('calendar')} onClear={() => setDate('')} />

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

            {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>{errMsg}</p>}
            <button onClick={handleSave} disabled={loading} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Dodaj pozajmicu'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DebtCard({ debt, onOpen }: { debt: Debt; onOpen: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editAmount, setEditAmount] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const pct = Math.min(100, debt.total_amount > 0 ? (debt.paid / debt.total_amount) * 100 : 0)
  const isOurs = debt.direction === 'dugujemo'
  const isSettled = debt.status === 'izmireno'
  const todayStr = new Date().toISOString().split('T')[0]
  const overdue = !isSettled && !!(debt.start_date && debt.start_date < todayStr)

  async function handleDelete() {
    await supabase.from('dugovi').delete().eq('id', debt.id)
    setConfirmDelete(false)
    router.refresh()
  }

  const actions = isSettled
    ? [{ label: 'Obriši', color: 'danger' as const, onClick: () => setConfirmDelete(true) }]
    : [
        { label: 'Izmeni', color: 'neutral' as const, onClick: () => setEditAmount(true) },
        { label: 'Obriši', color: 'danger' as const, onClick: () => setConfirmDelete(true) },
      ]

  return (
    <>
      <SwipeActions
        onTap={onOpen}
        tapLabel="Otvori"
        actions={actions}
        style={{ marginBottom: 8, opacity: isSettled ? 0.6 : 1 }}
      >
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 39 39" fill="none" stroke="var(--text-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5,11.5C5.28,5.14,12.15,1.5,19.54,1.5c9.36,0,17.05,7.1,17.96,16.2" />
                <path d="M10.52,12.3H2.58c-.6,0-1.08-.48-1.08-1.08h0V3.3" />
                <path d="M36.5,27.5c-2.78,6.36-9.64,10-17.04,10-9.36,0-17.05-7.1-17.96-16.2" />
                <path d="M28.48,26.7h7.94c.6,0,1.08.48,1.08,1.08,0,0,0,0,0,0v7.92" />
              </svg>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: isSettled ? 'var(--text-3)' : overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 3 }}>
                  {debt.name}
                </p>
                {debt.start_date && (
                  <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)', fontWeight: overdue ? 500 : 400 }}>
                    {overdue ? `Rok prošao: ${fmtDate(debt.start_date)}` : `Do: ${fmtDate(debt.start_date)}`}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
              {isSettled ? (
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                  Izmireno
                </span>
              ) : overdue ? (
                <>
                  <p className="num" style={{ fontSize: 16, fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>
                    {fmt(debt.remaining)}
                    <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{debt.currency}</span>
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--red)', color: '#fff' }}>
                    Kašnjenje!
                  </span>
                </>
              ) : (
                <>
                  <p className="num" style={{ fontSize: 16, fontWeight: 500, color: isOurs ? 'var(--red)' : 'var(--accent)', marginBottom: 2 }}>
                    {fmt(debt.remaining)}
                    <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{debt.currency}</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>od {fmt(debt.total_amount)}</p>
                </>
              )}
            </div>
            </div>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: isSettled ? 'var(--accent)' : overdue ? 'var(--red)' : (isOurs ? '#f87171' : 'var(--accent)'),
              width: `${pct}%`, transition: 'width 0.3s',
            }} />
          </div>
          {debt.note && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{debt.note}</p>}
        </div>
      </SwipeActions>

      {editAmount && (
        <EditAmountSheet
          title={debt.name}
          current={debt.total_amount}
          currency={debt.currency}
          onSave={async a => {
            await supabase.from('dugovi').update({ total_amount: a }).eq('id', debt.id)
            setEditAmount(false)
            router.refresh()
          }}
          onClose={() => setEditAmount(false)}
        />
      )}

      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDelete(false)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši pozajmicu?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Pozajmica i sve uplate biće trajno obrisane.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function DugoviClient({ debts, buckets }: { debts: Debt[]; buckets: { id: string; name: string }[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const selected = selectedId ? debts.find(d => d.id === selectedId) ?? null : null

  const active = debts.filter(d => d.status === 'aktivno')
  const settled = debts.filter(d => d.status === 'izmireno')
  const dugujemo = active.filter(d => d.direction === 'dugujemo')
  const dugujuNam = active.filter(d => d.direction === 'duguju_nam')

  return (
    <>
      {active.length === 0 && settled.length === 0 ? (
        <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema pozajmica.</p>
        </div>
      ) : (
        <>
          {dugujemo.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="section-label">Primljene pozajmice</p>
              {dugujemo.map(d => <DebtCard key={d.id} debt={d} onOpen={() => setSelectedId(d.id)} />)}
            </div>
          )}
          {dugujuNam.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="section-label">Date pozajmice</p>
              {dugujuNam.map(d => <DebtCard key={d.id} debt={d} onOpen={() => setSelectedId(d.id)} />)}
            </div>
          )}
          {settled.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="section-label">Izmireno</p>
              {settled.map(d => <DebtCard key={d.id} debt={d} onOpen={() => setSelectedId(d.id)} />)}
            </div>
          )}
        </>
      )}

      <button
        onClick={() => setShowAdd(true)}
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

      {selected && <DebtModal debt={selected} onClose={() => setSelectedId(null)} />}
      {showAdd && <AddDebtModal buckets={buckets} onClose={() => setShowAdd(false)} />}
    </>
  )
}
