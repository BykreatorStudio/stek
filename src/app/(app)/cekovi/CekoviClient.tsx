'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Cek } from '@/types'
import SwipeActions from '@/components/ui/SwipeActions'
import { notifyHousehold } from '@/lib/notify'

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function deleteCek(id: string) {
    await supabase.from('cekovi').delete().eq('id', id)
    setConfirmDelete(null)
    router.refresh()
  }

  const pending = checks.filter(c => c.status === 'na_cekanju')
  const paid = checks.filter(c => c.status === 'isplacen')

  async function markPaid(id: string) {
    await supabase.from('cekovi').update({ status: 'isplacen', cleared_at: new Date().toISOString() }).eq('id', id)
    setConfirmPay(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = await supabase.from('members').select('id, name').eq('user_id', user!.id).single()
    const cek = checks.find(c => c.id === id)
    notifyHousehold({
      triggeredByMemberId: member?.id,
      type: 'cek',
      title: 'Ček isplaćen',
      body: `${member?.name ?? 'Neko'} · ${cek ? `${cek.quantity} ${cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'} · ${fmt(cek.quantity * CEK_VALUE)} RSD` : ''}`,
    })
    router.refresh()
  }

  async function markUnpaid(id: string) {
    await supabase.from('cekovi').update({ status: 'na_cekanju', cleared_at: null }).eq('id', id)
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
              const overdue = diff < 0
              const daysLabel = overdue ? `Prošlo ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dan' : 'dana'}` : diff === 0 ? 'Danas' : `Za ${diff} ${diff === 1 ? 'dan' : 'dana'}`
              return (
                <SwipeActions
                  key={cek.id}
                  onTap={() => setConfirmPay(cek)}
                  tapLabel="Isplati"
                  actions={[{ label: 'Obriši', color: 'danger', onClick: () => setConfirmDelete(cek.id) }]}
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
                >
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: overdue ? 'rgba(217,48,37,0.1)' : '#f0f0f0',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke={overdue ? '#d93025' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="3" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: overdue ? 'var(--red)' : 'var(--text-1)' }}>
                        {fmtDate(cek.date)}
                      </p>
                      <p style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-3)' }}>
                        {cek.quantity} {cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'}
                        {` · ${daysLabel}`}
                        {cek.note && ` · ${cek.note}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p className="num" style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: overdue ? 'var(--red)' : 'var(--text-1)' }}>
                        {fmt(cek.quantity * CEK_VALUE)}
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.5 }}>RSD</span>
                      </p>
                      {overdue ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--red)', color: '#fff' }}>
                          Kašnjenje!
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--header-bg)', color: '#fff' }}>
                          {diff === 0 ? 'Danas!' : 'Naplati'}
                        </span>
                      )}
                    </div>
                  </div>
                </SwipeActions>
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
              <SwipeActions
                key={cek.id}
                actions={[
                  { label: 'Na čekanju', color: 'neutral', onClick: () => setConfirmUndo(cek) },
                  { label: 'Obriši', color: 'danger', onClick: () => setConfirmDelete(cek.id) },
                ]}
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
              >
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-light)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: 'var(--text-3)' }}>{fmtDate(cek.date)}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {cek.quantity} {cek.quantity === 1 ? 'ček' : cek.quantity < 5 ? 'čeka' : 'čekova'}
                      {cek.note && ` · ${cek.note}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: 'var(--text-3)' }}>
                      {fmt(cek.quantity * CEK_VALUE)}
                      <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.5 }}>RSD</span>
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                      Isplaćen
                    </span>
                  </div>
                </div>
              </SwipeActions>
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
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši ček?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ček će biti trajno obrisan.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => deleteCek(confirmDelete)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
