'use client'

import { useState } from 'react'
import AmountInput, { parseAmount } from './AmountInput'

export default function EditAmountSheet({
  title,
  current,
  currency = 'RSD',
  onSave,
  onClose,
}: {
  title: string
  current?: number
  currency?: string
  onSave: (amount: number) => Promise<void>
  onClose: () => void
}) {
  const [amount, setAmount] = useState(current ? String(Math.round(current)) : '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const a = parseAmount(amount)
    if (!a || a <= 0) return
    setLoading(true)
    await onSave(a)
    setLoading(false)
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
        style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>
        <div style={{ padding: '16px 20px calc(32px + var(--safe-bottom))' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>{title}</p>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <AmountInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
              autoFocus
              className="num"
              style={{
                flex: 1, padding: '14px 16px', fontSize: 22, fontWeight: 500,
                color: 'var(--text-1)', border: 'none', outline: 'none',
                background: 'transparent', fontFamily: 'inherit',
              }}
            />
            <span style={{ padding: '0 16px', fontSize: 13, color: 'var(--text-3)', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
              {currency}
            </span>
          </div>
          <button onClick={handleSave} disabled={loading || !parseAmount(amount)} className="btn-primary">
            {loading ? 'Čuvanje...' : 'Sačuvaj iznos'}
          </button>
        </div>
      </div>
    </div>
  )
}
