'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket } from '@/types'
import { useHouseholdId } from '@/hooks/useHouseholdId'

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export default function GrupeClient({ buckets }: { buckets: Bucket[] }) {
  const [editing, setEditing] = useState<Bucket | null>(null)
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const householdId = useHouseholdId()
  const supabase = createClient()
  const router = useRouter()

  function openAdd() {
    setEditing(null); setName(''); setShowForm(true)
  }
  function openEdit(b: Bucket) {
    setEditing(b); setName(b.name); setShowForm(true)
  }
  function closeForm() {
    setShowForm(false); setEditing(null); setName('')
  }

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    if (editing) {
      await supabase.from('buckets').update({ name: name.trim() }).eq('id', editing.id)
    } else {
      if (!householdId) { setLoading(false); return }
      const maxOrder = buckets.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
      await supabase.from('buckets').insert({ household_id: householdId, name: name.trim(), slug: slugify(name.trim()), sort_order: maxOrder + 1 })
    }
    setLoading(false); closeForm(); router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('buckets').delete().eq('id', id)
    setConfirmDeleteId(null); router.refresh()
  }

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p className="section-label" style={{ marginBottom: 0 }}>Sve grupe</p>
          <button onClick={openAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--accent)', padding: 0 }}>
            + Nova grupa
          </button>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {buckets.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '14px 20px' }}>Nema grupa.</p>
          ) : buckets.map((b, i) => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: i < buckets.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{b.name}</p>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <button onClick={() => openEdit(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                  Izmeni
                </button>
                <button onClick={() => setConfirmDeleteId(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>
                  Obriši
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, padding: '0 4px' }}>
          Grupe organizuju transakcije, kategorije i mesečne račune po segmentima (npr. Porodica, Firma).
        </p>
      </div>

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši grupu?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Biće obrisane i sve kategorije unutar nje.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {/* Form sheet */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={closeForm}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>
              {editing ? 'Izmeni grupu' : 'Nova grupa'}
            </p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Naziv grupe (npr. Porodica, Firma...)"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '13px 16px', fontSize: 14, color: 'var(--text-1)', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--card)', outline: 'none', fontFamily: 'inherit', marginBottom: 20 }}
            />
            <button onClick={handleSave} disabled={loading || !name.trim()} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
