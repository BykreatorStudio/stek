'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { notifyHousehold } from '@/lib/notify'
import CalendarPopup from '@/components/ui/CalendarPopup'
import AmountInput, { parseAmount, formatAmount } from '@/components/ui/AmountInput'
import SwipeActions, { SwipeAction } from '@/components/ui/SwipeActions'
import EditAmountSheet from '@/components/ui/EditAmountSheet'

type RecurringItem = {
  id: string; name: string; amount: number | null; currency: string
  due_day: number; type: 'fiksni' | 'varijabilni'
  bucket_id: string; category_id: string; bucketName: string
  paid: boolean; paidAmount: number | null; transactionId: string | null; skipAcc: boolean
}

type Credit = {
  id: string; name: string; monthly_payment: number; due_day: number
  bucket_id: string; bucketName: string; currency: string; paid: boolean
  original_amount: number; remaining_amount: number; creditPaymentId: string | null
}

type Check = {
  id: string; quantity: number; date: string; status: string; note: string | null
}

type Payment = { id: string; amount: number; currency: string; date: string; note: string | null; member?: { name: string } | null }
type Debt = {
  id: string; name: string; direction: string; status: string
  total_amount: number; paid: number; remaining: number; currency: string
  start_date: string | null; note: string | null
  payments: Payment[]
}

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDate(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function AlreadyPaidToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', marginBottom: 16, borderTop: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Označi kao plaćeno</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Ne utiče na dostupno ovog meseca</p>
      </div>
      <div style={{ width: 44, height: 26, borderRadius: 13, background: value ? 'var(--accent)' : 'var(--border-2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
      </div>
    </div>
  )
}

function defaultDateForMonth(month: string, dueDay?: number): string {
  if (dueDay) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    return `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`
  }
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return month === currentMonth ? today() : `${month}-01`
}

function CalendarView({ value, onChange, onBack }: { value: string; onChange: (v: string) => void; onBack: () => void }) {
  return (
    <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>Datum</span>
      </div>
      <CalendarPopup value={value} onChange={v => { onChange(v); onBack() }} onClose={onBack} inline />
    </div>
  )
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

function PayRecurringModal({ item, month, eurToRsd, onClose }: { item: RecurringItem; month: string; eurToRsd: number; onClose: () => void }) {
  const [amount, setAmount] = useState(item.amount ? formatAmount(String(item.amount).replace('.', ',')) : '')
  const [currency, setCurrency] = useState<'RSD' | 'EUR'>(item.currency as 'RSD' | 'EUR')
  const [date, setDate] = useState(() => defaultDateForMonth(month, item.due_day))
  const [view, setView] = useState<'main' | 'calendar'>('main')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(false)
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

  async function handlePay() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('transactions').insert({
      bucket_id: item.bucket_id, category_id: item.category_id,
      recurring_item_id: item.id, user_id: user!.id,
      member_id: currentMember?.id ?? null, name: item.name,
      type: 'rashod', amount: a, currency, date, month,
      skip_accounting: alreadyPaid,
    })
    setLoading(false)
    if (error) { setErrMsg(error.message); return }
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: 'racun_placen',
      title: 'Račun plaćen',
      body: `${currentMember?.name ?? 'Neko'} · ${item.name} · ${fmtN(a)} ${currency}`,
    })
    onClose(); router.refresh()
  }

  function handleCurrencyChange(c: 'RSD' | 'EUR') {
    const a = parseAmount(amount)
    if (a > 0) {
      if (currency === 'EUR' && c === 'RSD') {
        setAmount(formatAmount(String(Math.round(a * eurToRsd))))
      } else if (currency === 'RSD' && c === 'EUR') {
        setAmount(formatAmount(String((a / eurToRsd).toFixed(2).replace('.', ','))))
      }
    }
    setCurrency(c)
  }

  async function handleUpdateAmount() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    setLoading(true)
    await supabase.from('recurring_items').update({ amount: a, currency }).eq('id', item.id)
    setLoading(false)
    onClose(); router.refresh()
  }

  return (
    <Sheet onClose={onClose}>
      {view === 'calendar' ? (
        <CalendarView value={date} onChange={setDate} onBack={() => setView('main')} />
      ) : (
        <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
          <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{item.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
            {item.bucketName} · do {item.due_day}. u mesecu
          </p>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
            <AmountInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
              readOnly={item.type === 'fiksni'}
              className="num"
              style={{
                flex: 1, minWidth: 0, padding: '14px 16px', fontSize: 26, fontWeight: 500,
                color: 'var(--text-1)', border: 'none', outline: 'none',
                background: 'transparent', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 4, padding: '0 12px', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
              {(['RSD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => handleCurrencyChange(c)} style={{
                  padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: currency === c ? 'var(--text-1)' : 'var(--border)',
                  background: currency === c ? 'var(--text-1)' : 'transparent',
                  color: currency === c ? '#fff' : 'var(--text-3)',
                }}>{c}</button>
              ))}
            </div>
          </div>
          {item.type === 'varijabilni' && (
            <button
              onClick={handleUpdateAmount}
              disabled={loading || !parseAmount(amount)}
              style={{
                width: '100%', padding: '13px 16px', marginBottom: 10,
                border: '1.5px solid var(--border)', borderRadius: 12,
                background: 'var(--card)', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, color: 'var(--text-2)', fontFamily: 'inherit',
              }}
            >
              Sačuvaj iznos (bez plaćanja)
            </button>
          )}
          <button
            onClick={() => setView('calendar')}
            style={{
              width: '100%', padding: '13px 16px', marginBottom: 16,
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
          {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{errMsg}</p>}
          <AlreadyPaidToggle value={alreadyPaid} onChange={setAlreadyPaid} />
          <button onClick={handlePay} disabled={loading || !parseAmount(amount)} className="btn-primary">
            {loading ? 'Čuvanje...' : 'Označi kao plaćeno'}
          </button>
        </div>
      )}
    </Sheet>
  )
}

function PayKreditModal({ credit, month, onClose }: { credit: Credit; month: string; onClose: () => void }) {
  const [date, setDate] = useState(() => defaultDateForMonth(month, credit.due_day))
  const [view, setView] = useState<'main' | 'calendar'>('main')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(false)
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

  async function handlePay() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('credit_payments').insert({
      credit_id: credit.id, amount: credit.monthly_payment, date,
    })
    if (error) { setErrMsg(error.message); setLoading(false); return }
    if (alreadyPaid) {
      await supabase.from('transactions').insert({
        user_id: user!.id, member_id: currentMember?.id ?? null,
        name: credit.name, type: 'rashod',
        amount: credit.monthly_payment, currency: credit.currency,
        date, month, skip_accounting: true,
        bucket_id: credit.bucket_id,
      })
    }
    setLoading(false)
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: 'kredit_placen',
      title: 'Rata plaćena',
      body: `${currentMember?.name ?? 'Neko'} · ${credit.name} · ${fmtN(credit.monthly_payment)} ${credit.currency}`,
    })
    onClose(); router.refresh()
  }

  return (
    <Sheet onClose={onClose}>
      {view === 'calendar' ? (
        <CalendarView value={date} onChange={setDate} onBack={() => setView('main')} />
      ) : (
        <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
          <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{credit.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
            {credit.bucketName} · do {credit.due_day}. u mesecu
          </p>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
            <span className="num" style={{ flex: 1, minWidth: 0, padding: '14px 16px', fontSize: 26, fontWeight: 500, color: 'var(--text-2)' }}>
              {fmt(credit.monthly_payment)}
            </span>
            <span style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-3)', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
              RSD
            </span>
          </div>
          <button
            onClick={() => setView('calendar')}
            style={{
              width: '100%', padding: '13px 16px', marginBottom: 16,
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
          {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{errMsg}</p>}
          <AlreadyPaidToggle value={alreadyPaid} onChange={setAlreadyPaid} />
          <button onClick={handlePay} disabled={loading} className="btn-primary">
            {loading ? 'Čuvanje...' : 'Označi kao plaćeno'}
          </button>
        </div>
      )}
    </Sheet>
  )
}

function DebtModal({ debt, month, onClose }: { debt: Debt; month: string; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => defaultDateForMonth(month))
  const [note, setNote] = useState('')
  const [view, setView] = useState<'main' | 'calendar'>('main')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [confirmSettle, setConfirmSettle] = useState(false)
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

  const pct = Math.min(100, (debt.paid / debt.total_amount) * 100)

  async function addPayment() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('debt_payments').insert({
      debt_id: debt.id, amount: a, currency: debt.currency, date,
      note: note.trim() || null,
    })
    if (error) { setErrMsg(error.message); setLoading(false); return }

    if (alreadyPaid && debt.direction === 'dugujemo') {
      await supabase.from('transactions').insert({
        user_id: user!.id, member_id: currentMember?.id ?? null,
        name: debt.name, type: 'rashod',
        amount: a, currency: debt.currency,
        date, month, skip_accounting: true,
      })
    }

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
    setAmount(''); setNote(''); setAlreadyPaid(false); setErrMsg('')
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
    onClose(); router.refresh()
  }

  return (
    <>
      {confirmSettle && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
            padding: '0 24px',
          }}
          onClick={() => setConfirmSettle(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 360, background: 'var(--card)',
              borderRadius: 24, padding: '28px 24px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8, textAlign: 'center' }}>
              Označi kao izmiren
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, textAlign: 'center' }}>
              Dug &ldquo;{debt.name}&rdquo; će biti označen kao izmiren i sklonjen sa liste.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmSettle(false)}
                style={{
                  flex: 1, padding: '13px', borderRadius: 14, fontSize: 14,
                  border: '1.5px solid var(--border-2)', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit',
                }}
              >Otkaži</button>
              <button
                onClick={markSettled}
                style={{
                  flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500,
                  border: 'none', background: 'var(--text-1)',
                  cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                }}
              >Potvrdi</button>
            </div>
          </div>
        </div>
      )}
      <Sheet onClose={onClose}>
        {view === 'calendar' ? (
          <CalendarView value={date} onChange={setDate} onBack={() => setView('main')} />
        ) : (
          <div style={{ overflowY: 'auto', padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{debt.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              {debt.direction === 'dugujemo' ? 'Primljena pozajmica' : 'Data pozajmica'}
              {debt.start_date && ` · Do: ${fmtDate(debt.start_date)}`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Vraćeno {fmt(debt.paid)} / {fmt(debt.total_amount)} {debt.currency}</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                Preostalo: {fmt(debt.remaining)} {debt.currency}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'var(--border-2)', marginBottom: 20 }}>
              <div style={{
                height: '100%', borderRadius: 6,
                background: pct >= 100 ? 'var(--accent)' : debt.direction === 'dugujemo' ? '#f87171' : 'var(--accent)',
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
                        {p.note && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{p.note}</p>}
                      </div>
                      <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
                        +{fmt(p.amount)} {p.currency}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                outline: 'none', fontFamily: 'inherit', marginBottom: 12,
              }}
            />
            {errMsg && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{errMsg}</p>}
            {debt.direction === 'dugujemo' && <AlreadyPaidToggle value={alreadyPaid} onChange={setAlreadyPaid} />}
            <button onClick={addPayment} disabled={loading || !parseAmount(amount)} className="btn-primary" style={{ marginBottom: 10 }}>
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
          </div>
        )}
      </Sheet>
    </>
  )
}

type ExtraExpense = {
  id: string; name: string; amount: number; currency: string; date: string
  note: string | null; categoryName: string; bucketName: string
}

type ReceiptItem = { id: string; name: string; amount: number; currency: string; categoryName: string }
type Receipt = { id: string; merchantName: string; totalAmount: number; date: string; bucketName: string; items: ReceiptItem[] }

export default function TroskoviClient({ recurring, credits, checks, debts, extraExpenses, receipts, month, eurToRsd, monthStart, monthEnd }: {
  recurring: RecurringItem[]; credits: Credit[]; checks: Check[]; debts: Debt[]
  extraExpenses: ExtraExpense[]; receipts: Receipt[]; month: string; eurToRsd: number; monthStart: string; monthEnd: string
}) {
  const [payingRecurring, setPayingRecurring] = useState<RecurringItem | null>(null)
  const [payingCredit, setPayingCredit] = useState<Credit | null>(null)
  const [openDebtId, setOpenDebtId] = useState<string | null>(null)
  const [confirmPayCheck, setConfirmPayCheck] = useState<Check | null>(null)
  const [cekAlreadyPaid, setCekAlreadyPaid] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState<{ name: string; undoType: 'recurring' | 'credit' | 'check' | 'debt'; undoId: string } | null>(null)
  const [confirmDeleteCek, setConfirmDeleteCek] = useState<string | null>(null)
  const [confirmDeleteDebt, setConfirmDeleteDebt] = useState<string | null>(null)
  const [confirmDeleteRecurring, setConfirmDeleteRecurring] = useState<RecurringItem | null>(null)
  const [confirmDeleteCredit, setConfirmDeleteCredit] = useState<Credit | null>(null)
  const [confirmDeleteExtra, setConfirmDeleteExtra] = useState<string | null>(null)
  const [editExtra, setEditExtra] = useState<ExtraExpense | null>(null)
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)
  const [confirmDeleteReceipt, setConfirmDeleteReceipt] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState<RecurringItem | null>(null)
  const openDebt = openDebtId ? debts.find(d => d.id === openDebtId) ?? null : null
  const supabase = createClient()
  const router = useRouter()

  async function markCekPaid(id: string, skipAccounting = false) {
    await supabase.from('cekovi').update({ status: 'isplacen', cleared_at: new Date().toISOString() }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = await supabase.from('members').select('id, name').eq('user_id', user!.id).single()
    const cek = checks.find(c => c.id === id)
    if (skipAccounting && cek) {
      const cekMonth = cek.date.slice(0, 7)
      await supabase.from('transactions').insert({
        user_id: user!.id, member_id: member?.id ?? null,
        name: `${cek.quantity} ${cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'}`,
        type: 'rashod', amount: cek.quantity * CEK_VALUE, currency: 'RSD',
        date: cek.date, month: cekMonth, skip_accounting: true,
      })
    }
    notifyHousehold({
      triggeredByMemberId: member?.id,
      type: 'cek',
      title: 'Ček isplaćen',
      body: `${member?.name ?? 'Neko'} · ${cek ? `${cek.quantity} ${cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'} · ${fmt(cek.quantity * CEK_VALUE)} RSD` : ''}`,
    })
    router.refresh()
  }

  async function deleteCek(id: string) {
    await supabase.from('cekovi').delete().eq('id', id)
    setConfirmDeleteCek(null)
    router.refresh()
  }

  async function deleteDebt(id: string) {
    await supabase.from('dugovi').delete().eq('id', id)
    setConfirmDeleteDebt(null)
    router.refresh()
  }

  async function deleteRecurring(id: string) {
    await supabase.from('recurring_items').delete().eq('id', id)
    setConfirmDeleteRecurring(null)
    router.refresh()
  }

  async function deleteCredit(id: string) {
    await supabase.from('credits').delete().eq('id', id)
    setConfirmDeleteCredit(null)
    router.refresh()
  }

  async function deleteExtra(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    setConfirmDeleteExtra(null)
    router.refresh()
  }

  async function deleteReceipt(id: string) {
    await supabase.from('receipts').delete().eq('id', id)
    setConfirmDeleteReceipt(null)
    setOpenReceiptId(null)
    router.refresh()
  }

  async function handleUndo() {
    if (!confirmUndo) return
    const { undoType, undoId } = confirmUndo
    if (undoType === 'recurring') {
      await supabase.from('transactions').delete().eq('id', undoId)
    } else if (undoType === 'credit') {
      await supabase.from('credit_payments').delete().eq('id', undoId)
    } else if (undoType === 'check') {
      await supabase.from('cekovi').update({ status: 'na_cekanju', cleared_at: null }).eq('id', undoId)
    } else if (undoType === 'debt') {
      await supabase.from('dugovi').update({ status: 'aktivno' }).eq('id', undoId)
    }
    setConfirmUndo(null)
    router.refresh()
  }

  const unpaidRecurring = recurring.filter(r => !r.paid)
  const paidRecurring = recurring.filter(r => r.paid)
  const unpaidCredits = credits.filter(c => !c.paid)
  const paidCredits = credits.filter(c => c.paid)
  const pendingChecks = checks.filter(c => c.status === 'na_cekanju')
  const paidChecks = checks.filter(c => c.status === 'isplacen')

  const activeDebts = debts.filter(d => d.status === 'aktivno')
  const settledDebtsThisMonth = debts.filter(d =>
    d.status === 'izmireno' &&
    d.payments.some(p => p.date >= monthStart && p.date <= monthEnd)
  )

  const allPaid = [
    ...paidRecurring.map(r => ({ id: r.id, name: r.name, sub: r.bucketName, amount: r.paidAmount ?? r.amount, currency: r.currency, undoType: 'recurring' as const, undoId: r.transactionId ?? '', skipAcc: r.skipAcc })),
    ...paidCredits.map(c => ({ id: c.id, name: c.name, sub: c.bucketName, amount: c.monthly_payment, currency: c.currency, undoType: 'credit' as const, undoId: c.creditPaymentId ?? '', skipAcc: false })),
    ...paidChecks.map(c => ({ id: c.id, name: `${c.quantity} ${c.quantity === 1 ? 'ček' : c.quantity < 5 ? 'čeka' : 'čekova'}`, sub: fmtDate(c.date), amount: c.quantity * CEK_VALUE, currency: 'RSD', undoType: 'check' as const, undoId: c.id, skipAcc: false })),
    ...settledDebtsThisMonth.map(d => ({ id: d.id, name: d.name, sub: d.direction === 'dugujemo' ? 'Primljena pozajmica' : 'Data pozajmica', amount: d.total_amount, currency: d.currency, undoType: 'debt' as const, undoId: d.id, skipAcc: false })),
  ]

  const isEmpty = recurring.length === 0 && credits.length === 0 && pendingChecks.length === 0 && activeDebts.length === 0 && extraExpenses.length === 0 && receipts.length === 0 && allPaid.length === 0

  const todayStr = today()
  const todayDay = parseInt(todayStr.slice(8))
  const currentMonth = todayStr.slice(0, 7)

  function isMonthOverdue(dueDay: number): boolean {
    return month < currentMonth || (month === currentMonth && todayDay > dueDay)
  }

  const pendingBadge = (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--red-light)', color: 'var(--red)' }}>
      Na čekanju
    </span>
  )

  const overdueBadge = (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--red)', color: '#fff' }}>
      Kašnjenje!
    </span>
  )

  const paidBadge = (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
      Plaćeno
    </span>
  )

  const ranijePlaćenoBadge = (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-subtle)', color: 'var(--text-3)' }}>
      Označeno
    </span>
  )

  return (
    <>
      {unpaidRecurring.length > 0 && (
        <>
          <p className="section-label">Mesečni računi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {unpaidRecurring.map(r => {
              const overdue = isMonthOverdue(r.due_day)
              const actions: SwipeAction[] = [
                { label: 'Plati', color: 'primary', onClick: () => setPayingRecurring(r) },
                ...(r.type === 'varijabilni' ? [{ label: 'Izmeni', color: 'neutral' as const, onClick: () => setEditAmount(r) }] : []),
                { label: 'Obriši', color: 'danger' as const, onClick: () => setConfirmDeleteRecurring(r) },
              ]
              return (
                <SwipeActions key={r.id} actions={actions}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 3 }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)' }}>
                        {r.bucketName} · do {r.due_day}. u mesecu
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      {r.amount ? (
                        <p className="num" style={{ fontSize: 15, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 4 }}>
                          {fmt(r.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>{r.currency}</span>
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--text-3)', marginBottom: 4 }}>Varijabilno</p>
                      )}
                      {overdue ? overdueBadge : pendingBadge}
                    </div>
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        </>
      )}

      {unpaidCredits.length > 0 && (
        <>
          <p className="section-label">Krediti</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {unpaidCredits.map(c => {
              const overdue = isMonthOverdue(c.due_day)
              return (
                <SwipeActions key={c.id} actions={[
                  { label: 'Plati', color: 'primary', onClick: () => setPayingCredit(c) },
                  { label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteCredit(c) },
                ]}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 3 }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)' }}>
                          {c.bucketName} · do {c.due_day}. u mesecu
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <p className="num" style={{ fontSize: 15, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 4 }}>
                          {fmt(c.monthly_payment)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                        </p>
                        {overdue ? overdueBadge : pendingBadge}
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, background: overdue ? 'var(--red)' : 'var(--accent)',
                        width: `${Math.min(100, ((c.original_amount - c.remaining_amount) / c.original_amount) * 100)}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        </>
      )}

      {pendingChecks.length > 0 && (
        <>
          <p className="section-label">Čekovi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {pendingChecks.map(c => {
              const overdue = c.date < todayStr
              return (
                <SwipeActions
                  key={c.id}
                  actions={[
                    { label: 'Isplati', color: 'primary', onClick: () => setConfirmPayCheck(c) },
                    { label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteCek(c.id) },
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 3 }}>
                        {c.quantity} {c.quantity === 1 ? 'ček' : c.quantity < 5 ? 'čeka' : 'čekova'}
                      </p>
                      {c.date && <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)' }}>{fmtDate(c.date)}</p>}
                      {c.note && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.note}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p className="num" style={{ fontSize: 15, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 4 }}>
                        {fmt(c.quantity * CEK_VALUE)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                      </p>
                      {overdue ? overdueBadge : pendingBadge}
                    </div>
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        </>
      )}

      {activeDebts.length > 0 && (
        <>
          <p className="section-label">Pozajmice</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {activeDebts.map(d => {
              const overdue = !!(d.start_date && d.start_date < todayStr)
              return (
                <SwipeActions
                  key={d.id}
                  actions={[
                    { label: 'Otvori', color: 'primary', onClick: () => setOpenDebtId(d.id) },
                    { label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteDebt(d.id) },
                  ]}
                >
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--text-1)', marginBottom: 3 }}>{d.name}</p>
                        <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)' }}>
                          {d.direction === 'dugujemo' ? 'Primljena pozajmica' : 'Data pozajmica'}
                          {d.start_date && ` · Rok: ${fmtDate(d.start_date)}`}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <p className="num" style={{ fontSize: 15, fontWeight: 500, color: overdue ? 'var(--red)' : (d.direction === 'dugujemo' ? 'var(--red)' : 'var(--accent)'), marginBottom: 4 }}>
                          {fmt(d.remaining)} <span style={{ fontSize: 11, opacity: 0.6 }}>{d.currency}</span>
                        </p>
                        {overdue ? overdueBadge : pendingBadge}
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: overdue ? 'var(--red)' : (d.direction === 'dugujemo' ? '#f87171' : 'var(--accent)'),
                        width: `${Math.min(100, (d.paid / d.total_amount) * 100)}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        </>
      )}

      {allPaid.length > 0 && (
        <>
          <p className="section-label">Plaćeno</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {allPaid.map(item => {
              const isCheck = item.undoType === 'check'
              const isDebt = item.undoType === 'debt'
              const paidActions: SwipeAction[] = []
              if (item.undoId) {
                paidActions.push({
                  label: isCheck ? 'Na čekanju' : isDebt ? 'Aktivno' : 'Neplaćeno',
                  color: 'neutral',
                  onClick: () => setConfirmUndo({ name: item.name, undoType: item.undoType, undoId: item.undoId }),
                })
              }
              if (isCheck && item.undoId) {
                paidActions.push({ label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteCek(item.undoId) })
              }
              return (
                <SwipeActions key={item.id} actions={paidActions}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3 }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.sub}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      {item.amount != null && (
                        <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>
                          {fmt(item.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>{item.currency}</span>
                        </p>
                      )}
                      {item.skipAcc ? ranijePlaćenoBadge : paidBadge}
                    </div>
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        </>
      )}

      {(extraExpenses.length > 0 || receipts.length > 0) && (
        <>
          <p className="section-label">Ostali troškovi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {receipts.map(r => (
              <SwipeActions
                key={r.id}
                actions={[{ label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteReceipt(r.id) }]}
              >
                <div
                  onClick={() => setOpenReceiptId(r.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3 }}>
                      {r.merchantName || 'Fiskalni račun'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {r.bucketName ? `${r.bucketName} · ` : ''}{fmtDate(r.date)} · {r.items.length} {r.items.length === 1 ? 'stavka' : r.items.length < 5 ? 'stavke' : 'stavki'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>
                      {fmt(r.totalAmount)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                    </p>
                    {paidBadge}
                  </div>
                </div>
              </SwipeActions>
            ))}
            {extraExpenses.map(e => (
              <SwipeActions
                key={e.id}
                actions={[
                  { label: 'Izmeni', color: 'neutral', onClick: () => setEditExtra(e) },
                  { label: 'Obriši', color: 'danger', onClick: () => setConfirmDeleteExtra(e.id) },
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3 }}>
                      {e.name || 'Bez naziva'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {e.categoryName}{e.bucketName ? ` · ${e.bucketName}` : ''} · {fmtDate(e.date)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>
                      {fmt(e.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>{e.currency}</span>
                    </p>
                    {paidBadge}
                  </div>
                </div>
              </SwipeActions>
            ))}
          </div>
        </>
      )}

      {isEmpty && (
        <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema troškova za ovaj mesec.</p>
        </div>
      )}

      {confirmPayCheck && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', padding: '0 24px',
          }}
          onClick={() => setConfirmPayCheck(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Označi ček kao isplaćen?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
              {confirmPayCheck.quantity} {confirmPayCheck.quantity === 1 ? 'ček' : confirmPayCheck.quantity < 5 ? 'čeka' : 'čekova'} · {fmt(confirmPayCheck.quantity * CEK_VALUE)} RSD
            </p>
            <div
              onClick={() => setCekAlreadyPaid(!cekAlreadyPaid)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, cursor: 'pointer' }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Označi kao plaćeno</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Ne utiče na dostupno</p>
              </div>
              <div style={{ width: 40, height: 24, borderRadius: 12, background: cekAlreadyPaid ? 'var(--accent)' : 'var(--border-2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: cekAlreadyPaid ? 18 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setConfirmPayCheck(null); setCekAlreadyPaid(false) }} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer',
              }}>Otkaži</button>
              <button onClick={() => { markCekPaid(confirmPayCheck.id, cekAlreadyPaid); setConfirmPayCheck(null); setCekAlreadyPaid(false) }} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer',
              }}>Potvrdi</button>
            </div>
          </div>
        </div>
      )}

      {confirmUndo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', padding: '0 24px',
          }}
          onClick={() => setConfirmUndo(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Poništi plaćanje?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              &ldquo;{confirmUndo.name}&rdquo; će biti vraćeno na {confirmUndo.undoType === 'debt' ? 'aktivno' : 'neplaćeno'}.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmUndo(null)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer',
              }}>Otkaži</button>
              <button onClick={handleUndo} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer',
              }}>Poništi</button>
            </div>
          </div>
        </div>
      )}

      {payingRecurring && (
        <PayRecurringModal item={payingRecurring} month={month} eurToRsd={eurToRsd} onClose={() => setPayingRecurring(null)} />
      )}
      {payingCredit && (
        <PayKreditModal credit={payingCredit} month={month} onClose={() => setPayingCredit(null)} />
      )}
      {openDebt && (
        <DebtModal debt={openDebt} month={month} onClose={() => setOpenDebtId(null)} />
      )}

      {editAmount && (
        <EditAmountSheet
          title={editAmount.name}
          current={editAmount.amount ?? undefined}
          currency={editAmount.currency}
          onSave={async a => {
            await supabase.from('recurring_items').update({ amount: a }).eq('id', editAmount.id)
            setEditAmount(null)
            router.refresh()
          }}
          onClose={() => setEditAmount(null)}
        />
      )}

      {confirmDeleteCek && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteCek(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši ček?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ček će biti trajno obrisan.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteCek(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteCek(confirmDeleteCek)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDebt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteDebt(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši pozajmicu?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Pozajmica i sve uplate biće trajno obrisane.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteDebt(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteDebt(confirmDeleteDebt)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteRecurring && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteRecurring(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši račun?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              &ldquo;{confirmDeleteRecurring.name}&rdquo; će biti trajno obrisan i neće se više pojavljivati.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteRecurring(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteRecurring(confirmDeleteRecurring.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {editExtra && (
        <EditAmountSheet
          title={editExtra.name || 'Trošak'}
          current={editExtra.amount}
          currency={editExtra.currency}
          onSave={async a => {
            await supabase.from('transactions').update({ amount: a }).eq('id', editExtra.id)
            setEditExtra(null)
            router.refresh()
          }}
          onClose={() => setEditExtra(null)}
        />
      )}

      {confirmDeleteExtra && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteExtra(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši trošak?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Transakcija će biti trajno obrisana.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteExtra(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteExtra(confirmDeleteExtra)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCredit && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteCredit(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši kredit?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              &ldquo;{confirmDeleteCredit.name}&rdquo; i sve rate biće trajno obrisane.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteCredit(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteCredit(confirmDeleteCredit.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {openReceiptId && (() => {
        const receipt = receipts.find(r => r.id === openReceiptId)
        if (!receipt) return null
        return (
          <Sheet onClose={() => setOpenReceiptId(null)}>
            <div style={{ padding: '16px 20px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{receipt.merchantName || 'Fiskalni račun'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(receipt.date)}{receipt.bucketName ? ` · ${receipt.bucketName}` : ''}</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px 24px' }}>
              {receipt.items.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, marginBottom: 12, borderBottom: i < receipt.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-word' }}>{item.name}</p>
                    {item.categoryName && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.categoryName}</p>}
                  </div>
                  <p className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', flexShrink: 0 }}>
                    {fmt(item.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                  </p>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Ukupno</p>
                <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)' }}>
                  {fmt(receipt.totalAmount)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                </p>
              </div>
            </div>
            <div style={{ padding: '0 20px 24px', flexShrink: 0 }}>
              <button
                onClick={() => { setOpenReceiptId(null); setConfirmDeleteReceipt(receipt.id) }}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer' }}
              >
                Obriši račun
              </button>
            </div>
          </Sheet>
        )
      })()}

      {confirmDeleteReceipt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteReceipt(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši račun?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Račun i sve stavke biće trajno obrisani.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteReceipt(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteReceipt(confirmDeleteReceipt)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
