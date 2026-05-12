'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useHouseholdId } from '@/hooks/useHouseholdId'
import { notifyHousehold } from '@/lib/notify'
import CalendarPopup from '@/components/ui/CalendarPopup'
import AmountInput, { parseAmount, formatAmount } from '@/components/ui/AmountInput'

type RecurringItem = {
  id: string; name: string; amount: number | null; currency: string
  due_day: number; type: 'fiksni' | 'varijabilni'
  bucket_id: string; category_id: string; bucketName: string
  paid: boolean; paidAmount: number | null; transactionId: string | null
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
  id: string; name: string; direction: string
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

  async function handlePay() {
    const a = parseAmount(amount)
    if (!a || a <= 0 || !householdId) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('transactions').insert({
      household_id: householdId,
      bucket_id: item.bucket_id, category_id: item.category_id,
      recurring_item_id: item.id, user_id: user!.id,
      type: 'rashod', amount: a, currency, date, month,
      name: item.name, member_id: currentMember?.id ?? null,
    })
    setLoading(false)
    if (error) { setErrMsg(error.message); return }
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      householdId,
      triggeredByMemberId: currentMember?.id,
      type: 'racun_placen',
      title: currentMember?.name ?? 'Neko',
      body: `Platio/la: ${item.name} · ${fmtN(a)} ${currency}`,
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
              autoFocus
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

  async function handlePay() {
    if (!householdId) return
    setLoading(true)
    const { error } = await supabase.from('credit_payments').insert({
      household_id: householdId,
      credit_id: credit.id, amount: credit.monthly_payment, date, member_id: currentMember?.id ?? null,
    })
    setLoading(false)
    if (error) { setErrMsg(error.message); return }
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      householdId,
      triggeredByMemberId: currentMember?.id,
      type: 'kredit_placen',
      title: currentMember?.name ?? 'Neko',
      body: `Rata: ${credit.name} · ${fmtN(credit.monthly_payment)} ${credit.currency}`,
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
  const [confirmSettle, setConfirmSettle] = useState(false)
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

  const pct = Math.min(100, (debt.paid / debt.total_amount) * 100)

  async function addPayment() {
    const a = parseAmount(amount)
    if (!a || a <= 0 || !householdId) return
    setLoading(true)
    const { error } = await supabase.from('debt_payments').insert({
      household_id: householdId,
      debt_id: debt.id, amount: a, currency: debt.currency, date,
      note: note.trim() || null, member_id: currentMember?.id ?? null,
    })
    setLoading(false)
    if (error) { setErrMsg(error.message); return }
    const fmtN = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    notifyHousehold({
      householdId,
      triggeredByMemberId: currentMember?.id,
      type: 'dug_placen',
      title: currentMember?.name ?? 'Neko',
      body: `Uplata duga: ${debt.name} · ${fmtN(a)} ${debt.currency}`,
    })
    setAmount(''); setNote(''); setErrMsg('')
    router.refresh()
  }

  async function markSettled() {
    await supabase.from('debts').update({ status: 'izmireno' }).eq('id', debt.id)
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
              {debt.direction === 'dugujemo' ? 'Mi dugujemo' : 'Duguju nam'}
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
              autoFocus
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

export default function TroskoviClient({ recurring, credits, checks, debts, extraExpenses, month, eurToRsd }: {
  recurring: RecurringItem[]; credits: Credit[]; checks: Check[]; debts: Debt[]
  extraExpenses: ExtraExpense[]; month: string; eurToRsd: number
}) {
  const [payingRecurring, setPayingRecurring] = useState<RecurringItem | null>(null)
  const [payingCredit, setPayingCredit] = useState<Credit | null>(null)
  const [openDebtId, setOpenDebtId] = useState<string | null>(null)
  const [confirmPayCheck, setConfirmPayCheck] = useState<Check | null>(null)
  const [confirmUndo, setConfirmUndo] = useState<{ name: string; undoType: 'recurring' | 'credit' | 'check'; undoId: string } | null>(null)
  const openDebt = openDebtId ? debts.find(d => d.id === openDebtId) ?? null : null
  const supabase = createClient()
  const router = useRouter()

  async function markCekPaid(id: string) {
    await supabase.from('checks').update({ status: 'isplacen', cleared_at: new Date().toISOString() }).eq('id', id)
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
      await supabase.from('checks').update({ status: 'na_cekanju', cleared_at: null }).eq('id', undoId)
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

  const allPaid = [
    ...paidRecurring.map(r => ({ id: r.id, name: r.name, sub: r.bucketName, amount: r.paidAmount ?? r.amount, currency: r.currency, undoType: 'recurring' as const, undoId: r.transactionId ?? '' })),
    ...paidCredits.map(c => ({ id: c.id, name: c.name, sub: c.bucketName, amount: c.monthly_payment, currency: c.currency, undoType: 'credit' as const, undoId: c.creditPaymentId ?? '' })),
    ...paidChecks.map(c => ({ id: c.id, name: `${c.quantity} ${c.quantity === 1 ? 'ček' : c.quantity < 5 ? 'čeka' : 'čekova'}`, sub: fmtDate(c.date), amount: c.quantity * CEK_VALUE, currency: 'RSD', undoType: 'check' as const, undoId: c.id })),
  ]

  const isEmpty = recurring.length === 0 && credits.length === 0 && pendingChecks.length === 0 && debts.length === 0 && extraExpenses.length === 0 && allPaid.length === 0

  const pendingBadge = (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--red-light)', color: 'var(--red)' }}>
      Na čekanju
    </span>
  )

  const paidBadge = (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
      Plaćeno
    </span>
  )

  return (
    <>
      {unpaidRecurring.length > 0 && (
        <>
          <p className="section-label">Mesečni računi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {unpaidRecurring.map(r => (
              <div key={r.id} className="card" onClick={() => setPayingRecurring(r)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{r.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.bucketName} · do {r.due_day}. u mesecu</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  {r.amount ? (
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>
                      {fmt(r.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>{r.currency}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Varijabilno</p>
                  )}
                  {pendingBadge}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {unpaidCredits.length > 0 && (
        <>
          <p className="section-label">Krediti</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {unpaidCredits.map(c => (
              <div key={c.id} className="card" onClick={() => setPayingCredit(c)}
                style={{ padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.bucketName} · do {c.due_day}. u mesecu</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>
                      {fmt(c.monthly_payment)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                    </p>
                    {pendingBadge}
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: 'var(--accent)',
                    width: `${Math.min(100, ((c.original_amount - c.remaining_amount) / c.original_amount) * 100)}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pendingChecks.length > 0 && (
        <>
          <p className="section-label">Čekovi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {pendingChecks.map(c => (
              <div key={c.id} className="card" onClick={() => setConfirmPayCheck(c)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>
                    {c.quantity} {c.quantity === 1 ? 'ček' : c.quantity < 5 ? 'čeka' : 'čekova'}
                  </p>
                  {c.date && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(c.date)}</p>}
                  {c.note && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.note}</p>}
                </div>
                <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', flexShrink: 0, marginLeft: 12 }}>
                  {fmt(c.quantity * CEK_VALUE)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {debts.length > 0 && (
        <>
          <p className="section-label">Dugovi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {debts.map(d => (
              <div key={d.id} className="card" onClick={() => setOpenDebtId(d.id)}
                style={{ padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{d.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {d.direction === 'dugujemo' ? 'Mi dugujemo' : 'Duguju nam'}
                    </p>
                  </div>
                  <p className="num" style={{ fontSize: 15, fontWeight: 500, color: d.direction === 'dugujemo' ? 'var(--red)' : 'var(--accent)', flexShrink: 0, marginLeft: 12 }}>
                    {fmt(d.remaining)} <span style={{ fontSize: 11, opacity: 0.6 }}>{d.currency}</span>
                  </p>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: d.direction === 'dugujemo' ? '#f87171' : 'var(--accent)',
                    width: `${Math.min(100, (d.paid / d.total_amount) * 100)}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {allPaid.length > 0 && (
        <>
          <p className="section-label">Plaćeno</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {allPaid.map(item => (
              <div key={item.id} className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3 }}>{item.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.sub}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    {item.amount != null && (
                      <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>
                        {fmt(item.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>{item.currency}</span>
                      </p>
                    )}
                    {paidBadge}
                  </div>
                  {item.undoId && (
                    <button
                      onClick={() => setConfirmUndo({ name: item.name, undoType: item.undoType, undoId: item.undoId })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {extraExpenses.length > 0 && (
        <>
          <p className="section-label">Ostali troškovi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {extraExpenses.map(e => (
              <div key={e.id} className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3 }}>
                    {e.name || 'Bez naziva'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
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
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              {confirmPayCheck.quantity} {confirmPayCheck.quantity === 1 ? 'ček' : confirmPayCheck.quantity < 5 ? 'čeka' : 'čekova'} · {fmt(confirmPayCheck.quantity * CEK_VALUE)} RSD
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmPayCheck(null)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer',
              }}>Otkaži</button>
              <button onClick={() => { markCekPaid(confirmPayCheck.id); setConfirmPayCheck(null) }} style={{
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
              &ldquo;{confirmUndo.name}&rdquo; će biti vraćeno na neplaćeno.
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
    </>
  )
}
