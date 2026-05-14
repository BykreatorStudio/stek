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

function TxRow({ t, border }: { t: any; border?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 20px',
      borderBottom: border ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{fmtDateShort(t.date)}</p>
      </div>
      <p className="num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, marginLeft: 12, color: txColor(t.type) }}>
        {txPrefix(t.type)}{fmt(t.amount)}
        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{t.currency}</span>
      </p>
    </div>
  )
}

export default function TransakcijeSection({ recentTxs }: { recentTxs: any[] }) {
  const [showAll, setShowAll] = useState(false)
  const [allTxs, setAllTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function openAll() {
    setShowAll(true)
    if (allTxs.length === 0) {
      setLoading(true)
      const [{ data: txData }, { data: savData }] = await Promise.all([
        supabase.from('transactions').select('id, type, name, amount, currency, date, created_at').order('created_at', { ascending: false }),
        supabase.from('savings').select('id, amount, date, created_at, sef:sefovi(name)').order('created_at', { ascending: false }),
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
      const merged = [...(txData ?? []), ...savEntries]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setAllTxs(merged)
      setLoading(false)
    }
  }

  if (recentTxs.length === 0) return null

  return (
    <>
      <p className="section-label">Poslednje</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {recentTxs.map((t: any) => (
          <div key={t.id} className="card" style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{fmtDateShort(t.date)}</p>
            </div>
            <p className="num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, marginLeft: 12, color: txColor(t.type) }}>
              {txPrefix(t.type)}{fmt(t.amount)}
              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{t.currency}</span>
            </p>
          </div>
        ))}
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
                  {allTxs.map((t: any, i: number) => (
                    <TxRow key={t.id} t={t} border={i < allTxs.length - 1} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
