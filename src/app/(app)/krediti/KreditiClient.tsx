'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { notifyHousehold } from '@/lib/notify'
import { useHouseholdId } from '@/hooks/useHouseholdId'
import CalendarPopup from '@/components/ui/CalendarPopup'
import Select from '@/components/ui/Select'
import AmountInput, { parseAmount } from '@/components/ui/AmountInput'

type Bucket = { id: string; name: string }
type Payment = { id: string; amount: number; date: string }
type Credit = {
  id: string
  name: string
  monthly_payment: number
  due_day: number
  original_amount: number
  remaining_amount: number
  currency: string
  note: string | null
  status: string
  paidThisMonth: boolean
  bucket: Bucket | null
  payments: Payment[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDate(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

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

function KreditModal({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  const [view, setView] = useState<'main' | 'calendar'>('main')
  const [payDate, setPayDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const householdId = useHouseholdId()

  const pct = credit.original_amount > 0
    ? Math.min(100, Math.round(((credit.original_amount - credit.remaining_amount) / credit.original_amount) * 100))
    : 0

  async function handlePay() {
    setLoading(true)
    const newRemaining = Math.max(0, credit.remaining_amount - credit.monthly_payment)
    await supabase.from('credit_payments').insert({ credit_id: credit.id, amount: credit.monthly_payment, date: payDate })
    await supabase.from('credits').update({
      remaining_amount: newRemaining,
      ...(newRemaining <= 0 ? { status: 'zatvoren' } : {}),
    }).eq('id', credit.id)
    if (householdId) {
      const fmt = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
      notifyHousehold({
        householdId,
        type: 'kredit_placen',
        title: 'Rata plaćena',
        body: `${credit.name} · ${fmt(credit.monthly_payment)} ${credit.currency}`,
      })
    }
    setLoading(false)
    onClose()
    router.refresh()
  }

  const sorted = [...credit.payments].sort((a, b) => b.date.localeCompare(a.date))

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
          <CalendarView title="Datum uplate" value={payDate} onChange={setPayDate} onBack={() => setView('main')} />
        ) : (
          <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{credit.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              {credit.bucket?.name} · Rata: {fmt(credit.monthly_payment)} RSD · {credit.due_day}. u mesecu
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Otplaćeno {pct}%</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                Preostalo: {fmt(credit.remaining_amount)} RSD
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'var(--border-2)', marginBottom: 20 }}>
              <div style={{ height: '100%', borderRadius: 6, background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>

            {!credit.paidThisMonth && credit.remaining_amount > 0 && (
              <>
                <p className="section-label">Označi ratu</p>
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
                  <span>{fmtDate(payDate)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="3" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
                <button onClick={handlePay} disabled={loading} className="btn-primary" style={{ marginBottom: 20 }}>
                  {loading ? 'Čuvanje...' : `Plaćeno · ${fmt(credit.monthly_payment)} RSD`}
                </button>
              </>
            )}

            {sorted.length > 0 && (
              <>
                <p className="section-label">Istorija uplata</p>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {sorted.map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{fmtDate(p.date)}</p>
                      <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
                        +{fmt(p.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
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

function AddKreditModal({ buckets, onClose }: { buckets: Bucket[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [rata, setRata] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [remaining, setRemaining] = useState('')
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    const r = parseAmount(rata)
    const rem = parseAmount(remaining)
    if (!name.trim() || !r || r <= 0 || !rem || rem <= 0 || !bucketId) return
    setLoading(true)
    await supabase.from('credits').insert({
      name: name.trim(),
      monthly_payment: r,
      due_day: Math.min(31, Math.max(1, parseInt(dueDay) || 1)),
      original_amount: rem,
      remaining_amount: rem,
      currency: 'RSD',
      bucket_id: bucketId,
      note: note.trim() || null,
    })
    setLoading(false)
    onClose()
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 14,
    color: 'var(--text-1)', border: '1.5px solid var(--border)',
    borderRadius: 12, background: 'var(--card)',
    outline: 'none', fontFamily: 'inherit',
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

        <div style={{ overflowY: 'auto', padding: '8px 20px calc(32px + var(--safe-bottom))' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>Novi kredit</p>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Naziv kredita"
            autoFocus
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <Select
            value={bucketId}
            onChange={setBucketId}
            options={buckets.map(b => ({ label: b.name, value: b.id }))}
            style={{ marginBottom: 10 }}
          />

          <AmountInput
            value={rata}
            onChange={setRata}
            placeholder="Mesečna rata (RSD)"
            className="num"
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <AmountInput
            value={remaining}
            onChange={setRemaining}
            placeholder="Trenutno preostalo (RSD)"
            className="num"
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <Select
            value={dueDay}
            onChange={setDueDay}
            options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. u mesecu` }))}
            style={{ marginBottom: 10 }}
          />

          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Napomena (opciono)"
            style={{ ...inputStyle, marginBottom: 20 }}
          />

          <button
            onClick={handleSave}
            disabled={loading || !name.trim() || !rata || !remaining || !bucketId}
            className="btn-primary"
          >
            {loading ? 'Čuvanje...' : 'Dodaj kredit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function KreditCard({ credit, onOpen }: { credit: Credit; onOpen: () => void }) {
  const pct = credit.original_amount > 0
    ? Math.min(100, Math.round(((credit.original_amount - credit.remaining_amount) / credit.original_amount) * 100))
    : 0

  return (
    <div className="card" style={{ padding: '16px 20px', marginBottom: 8, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{credit.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {fmt(credit.monthly_payment)} RSD/mes · {credit.due_day}. u mesecu
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="num" style={{ fontSize: 16, fontWeight: 500, color: '#f87171', marginBottom: 2 }}>
            {fmt(credit.remaining_amount)}
            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: credit.paidThisMonth ? 'var(--accent)' : 'var(--red)' }}>
            {credit.paidThisMonth ? 'Plaćeno' : 'Na čekanju'}
          </p>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
      {credit.note && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{credit.note}</p>}
    </div>
  )
}

export default function KreditiClient({ credits, buckets }: { credits: Credit[]; buckets: Bucket[] }) {
  const [selected, setSelected] = useState<Credit | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const grouped = buckets
    .map(b => ({ name: b.name, items: credits.filter(c => c.bucket?.name === b.name) }))
    .filter(g => g.items.length > 0)

  const ungrouped = credits.filter(c => !c.bucket)

  return (
    <>
      {credits.length === 0 ? (
        <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema aktivnih kredita.</p>
        </div>
      ) : (
        <>
          {grouped.map(g => (
            <div key={g.name} style={{ marginBottom: 20 }}>
              <p className="section-label">{g.name}</p>
              {g.items.map(c => <KreditCard key={c.id} credit={c} onOpen={() => setSelected(c)} />)}
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="section-label">Ostalo</p>
              {ungrouped.map(c => <KreditCard key={c.id} credit={c} onOpen={() => setSelected(c)} />)}
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

      {selected && <KreditModal credit={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddKreditModal buckets={buckets} onClose={() => setShowAdd(false)} />}
    </>
  )
}
