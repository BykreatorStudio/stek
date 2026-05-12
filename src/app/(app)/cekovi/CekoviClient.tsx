'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Cek } from '@/types'

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(n)
}

function fmtDate(v: string) {
  if (!v) return ''
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

export default function CekoviClient({ checks }: { checks: Cek[] }) {
  const [confirmPay, setConfirmPay] = useState<Cek | null>(null)
  const [confirmUndo, setConfirmUndo] = useState<Cek | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const pending = checks.filter(c => c.status === 'na_cekanju')
  const paid = checks.filter(c => c.status === 'isplacen')

  async function markPaid(id: string) {
    await supabase.from('checks').update({ status: 'isplacen', cleared_at: new Date().toISOString() }).eq('id', id)
    setConfirmPay(null)
    router.refresh()
  }

  async function markUnpaid(id: string) {
    await supabase.from('checks').update({ status: 'na_cekanju', cleared_at: null }).eq('id', id)
    setConfirmUndo(null)
    router.refresh()
  }

  if (pending.length === 0 && paid.length === 0) {
    return (
      <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema čekova. Dodaj prvi preko + dugmeta.</p>
      </div>
    )
  }

  return (
    <>
      {pending.length > 0 && (
        <>
          <p className="section-label">Na čekanju</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: paid.length > 0 ? 16 : 0 }}>
            {pending.map(cek => {
              const diff = daysUntil(cek.date)
              const daysLabel = diff < 0 ? `Prošlo ${Math.abs(diff)} dana` : diff === 0 ? 'Danas' : `Za ${diff} dana`
              const daysColor = diff < 0 || diff === 0 ? 'var(--red)' : diff <= 3 ? '#f59e0b' : 'var(--text-3)'
              return (
                <div key={cek.id} className="card" onClick={() => setConfirmPay(cek)}
                  style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: 'var(--text-1)' }}>{fmtDate(cek.date)}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {cek.quantity} {cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'}
                      <span style={{ color: daysColor }}> · {daysLabel}</span>
                      {cek.note && ` · ${cek.note}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: 'var(--text-1)' }}>
                      {fmt(cek.quantity * CEK_VALUE)}
                      <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.5 }}>RSD</span>
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--header-bg)', color: '#fff' }}>
                      Naplati
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {paid.length > 0 && (
        <>
          <p className="section-label">Isplaćeno</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paid.map(cek => (
              <div key={cek.id} className="card"
                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'default', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-light)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: 'var(--text-3)' }}>{fmtDate(cek.date)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {cek.quantity} {cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'}
                    {cek.note && ` · ${cek.note}`}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: 'var(--text-3)' }}>
                      {fmt(cek.quantity * CEK_VALUE)}
                      <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.5 }}>RSD</span>
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                      Isplaćen
                    </span>
                  </div>
                  <button
                    onClick={() => setConfirmUndo(cek)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7v6h6" />
                      <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirm pay */}
      {confirmPay && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmPay(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Označi ček kao isplaćen?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              {confirmPay.quantity} {confirmPay.quantity === 1 ? 'ček' : confirmPay.quantity < 5 ? 'čeka' : 'čekova'} · {fmt(confirmPay.quantity * CEK_VALUE)} RSD
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmPay(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>
                Otkaži
              </button>
              <button onClick={() => markPaid(confirmPay.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer' }}>
                Potvrdi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm undo */}
      {confirmUndo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmUndo(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Poništi isplatu?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              Ček od {fmtDate(confirmUndo.date)} će biti vraćen na čekanje.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmUndo(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>
                Otkaži
              </button>
              <button onClick={() => markUnpaid(confirmUndo.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer' }}>
                Poništi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
