'use client'

import { useState } from 'react'

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}

function fmtDateShort(v: string) {
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' })
}

type MemberStat = {
  id: string
  name: string
  avatar_url: string | null
  prihodi: number
  rashodi: number
  count: number
  txs: any[]
}

export default function MemberStats({ memberStats, month }: { memberStats: MemberStat[]; month: string }) {
  const [selected, setSelected] = useState<MemberStat | null>(null)

  return (
    <>
      <p className="section-label">Po članovima</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {memberStats.map((m) => (
          <button
            key={m.id}
            onClick={() => { if (m.count > 0) setSelected(m) }}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 16,
              background: 'var(--card)', border: '1px solid rgba(0,0,0,0.04)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              cursor: m.count > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{m.name.charAt(0)}</span>
                </div>
              )}
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{m.name}</p>
            </div>
            {m.count > 0 ? (
              <>
                {m.rashodi > 0 && (
                  <p className="num" style={{ fontSize: 13, color: 'var(--red)', marginBottom: 2 }}>-{fmt(m.rashodi)} RSD</p>
                )}
                {m.prihodi > 0 && (
                  <p className="num" style={{ fontSize: 13, color: 'var(--accent)' }}>+{fmt(m.prihodi)} RSD</p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>—</p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setSelected(null)}
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

            <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt={selected.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{selected.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>{selected.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{month}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {selected.prihodi > 0 && (
                  <div style={{ flex: 1, background: 'var(--accent-light)', borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ fontSize: 10, color: 'var(--accent-dark)', fontWeight: 500, marginBottom: 2 }}>Prihodi</p>
                    <p className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-dark)' }}>+{fmt(selected.prihodi)} RSD</p>
                  </div>
                )}
                {selected.rashodi > 0 && (
                  <div style={{ flex: 1, background: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ fontSize: 10, color: 'var(--red)', fontWeight: 500, marginBottom: 2 }}>Rashodi</p>
                    <p className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>-{fmt(selected.rashodi)} RSD</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowY: 'auto', paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...selected.txs]
                  .sort((a, b) => new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime())
                  .map((t, i, arr) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 20px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{fmtDateShort(t.date)}</p>
                      </div>
                      <p className="num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, marginLeft: 12, color: t.type === 'prihod' ? 'var(--accent)' : 'var(--text-1)' }}>
                        {t.type === 'prihod' ? '+' : '-'}{fmt(t.amount)}
                        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>{t.currency}</span>
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
