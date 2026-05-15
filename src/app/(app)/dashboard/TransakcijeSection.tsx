'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDateShort(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' })
}

function txColor(type: string) {
  if (type === 'prihod' || type === 'sef_isplata') return 'var(--accent)'
  if (type === 'sef_uplata') return '#0f766e'
  return 'var(--text-1)'
}

function txPrefix(type: string) {
  if (type === 'prihod' || type === 'sef_isplata') return '+'
  return '-'
}

function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V4a2 2 0 0 0-2-2z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function TxRow({ t, border }: { t: any; border?: boolean }) {
  const sub = [t.member?.name, t.category?.bucket?.name, t.category?.name, fmtDateShort(t.date)].filter(Boolean).join(' · ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 20px',
      borderBottom: border ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || '—'}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
      </div>
      <p className="num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, marginLeft: 12, color: txColor(t.type) }}>
        {txPrefix(t.type)}{fmt(t.amount)}
        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{t.currency}</span>
      </p>
    </div>
  )
}

type ReceiptItem = { id: string; name: string; amount: number; currency: string; categoryName: string }

export default function TransakcijeSection({ recentTxs }: { recentTxs: any[] }) {
  const [showAll, setShowAll] = useState(false)
  const [allTxs, setAllTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)
  const [openReceiptName, setOpenReceiptName] = useState('')
  const [openReceiptItems, setOpenReceiptItems] = useState<ReceiptItem[] | null>(null)
  const supabase = createClient()

  async function openAll() {
    setShowAll(true)
    if (allTxs.length === 0) {
      setLoading(true)
      const [{ data: txData }, { data: savData }, { data: recData }] = await Promise.all([
        supabase.from('transactions').select('id, type, name, amount, currency, date, created_at, member:members(name), category:categories(name, bucket:buckets(name))').is('receipt_id', null).order('created_at', { ascending: false }),
        supabase.from('savings').select('id, amount, date, created_at, sef:sefovi(name)').order('created_at', { ascending: false }),
        supabase.from('receipts').select('id, merchant_name, total_amount, date, created_at').order('created_at', { ascending: false }),
      ])
      const savEntries = (savData ?? []).map((s: any) => ({
        id: `sef-${s.id}`,
        type: s.amount > 0 ? 'sef_uplata' : 'sef_isplata',
        name: s.amount > 0 ? `Uplata u sef "${s.sef?.name ?? 'Sef'}"` : `Isplata iz sefa "${s.sef?.name ?? 'Sef'}"`,
        amount: Math.abs(s.amount),
        currency: 'RSD',
        date: s.date,
        created_at: s.created_at,
      }))
      const recEntries = (recData ?? []).map((r: any) => ({
        id: `receipt-${r.id}`,
        receiptId: r.id,
        type: 'receipt',
        name: r.merchant_name || 'Fiskalni račun',
        amount: r.total_amount,
        currency: 'RSD',
        date: r.date,
        created_at: r.created_at,
      }))
      const merged = [...(txData ?? []), ...savEntries, ...recEntries]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setAllTxs(merged)
      setLoading(false)
    }
  }

  async function openReceipt(id: string, name: string) {
    setOpenReceiptId(id)
    setOpenReceiptName(name)
    setOpenReceiptItems(null)
    const { data } = await supabase.from('transactions')
      .select('id, name, amount, currency, categories(name)')
      .eq('receipt_id', id)
      .order('id')
    setOpenReceiptItems((data ?? []).map((t: any) => ({
      id: t.id, name: t.name ?? '', amount: t.amount,
      currency: t.currency, categoryName: t.categories?.name ?? '',
    })))
  }

  function renderRow(t: any, border: boolean) {
    if (t.type === 'receipt') {
      return (
        <div
          key={t.id}
          onClick={() => openReceipt(t.receiptId, t.name)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 20px', cursor: 'pointer',
            borderBottom: border ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ReceiptIcon />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Račun · {fmtDateShort(t.date)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
              -{fmt(t.amount)} <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>RSD</span>
            </p>
            <ChevronRight />
          </div>
        </div>
      )
    }
    return <TxRow key={t.id} t={t} border={border} />
  }

  if (recentTxs.length === 0) return null

  return (
    <>
      <p className="section-label">Poslednje</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {recentTxs.map((t: any) => {
          if (t.type === 'receipt') {
            return (
              <div
                key={t.id}
                className="card"
                onClick={() => openReceipt(t.receiptId, t.name)}
                style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ReceiptIcon />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Račun · {fmtDateShort(t.date)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                    -{fmt(t.amount)} <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>RSD</span>
                  </p>
                  <ChevronRight />
                </div>
              </div>
            )
          }
          const sub = [t.member?.name, t.category?.bucket?.name, t.category?.name, fmtDateShort(t.date)].filter(Boolean).join(' · ')
          return (
            <div key={t.id} className="card" style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || '—'}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
              </div>
              <p className="num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, marginLeft: 12, color: txColor(t.type) }}>
                {txPrefix(t.type)}{fmt(t.amount)}
                <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{t.currency}</span>
              </p>
            </div>
          )
        })}
        <button
          onClick={openAll}
          style={{
            width: '100%', padding: '13px', borderRadius: 14, fontSize: 13, fontWeight: 500,
            border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Vidi sve
        </button>
      </div>

      {showAll && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowAll(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 540,
              background: 'var(--card)',
              borderRadius: '28px 28px 0 0',
              maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', padding: '4px 20px 16px', flexShrink: 0 }}>Sve aktivnosti</p>

            <div style={{ overflowY: 'auto', paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
              {loading ? (
                <p style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 14 }}>Učitavanje...</p>
              ) : allTxs.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 14 }}>Nema transakcija.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {allTxs.map((t: any, i: number) => renderRow(t, i < allTxs.length - 1))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openReceiptId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => { setOpenReceiptId(null); setOpenReceiptItems(null) }}
        >
          <div
            style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <div style={{ padding: '14px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>{openReceiptName}</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px calc(24px + var(--safe-bottom))' }}>
              {openReceiptItems === null ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border-2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              ) : openReceiptItems.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>Nema stavki.</p>
              ) : (
                openReceiptItems.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, marginBottom: 12, borderBottom: i < openReceiptItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-word' }}>{item.name}</p>
                      {item.categoryName && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.categoryName}</p>}
                    </div>
                    <p className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', flexShrink: 0 }}>
                      {fmt(item.amount)} <span style={{ fontSize: 11, opacity: 0.6 }}>RSD</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
