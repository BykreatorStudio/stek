'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket } from '@/types'
export default function GrupeClient({ buckets, householdId }: { buckets: Bucket[]; householdId: string }) {
  const [editing, setEditing] = useState<Bucket | null>(null)
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteAllId, setConfirmDeleteAllId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true); setError('')
    let err
    if (editing) {
      ({ error: err } = await supabase.from('buckets').update({ name: name.trim() }).eq('id', editing.id))
    } else {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-') || `bucket-${Date.now()}`
      ;({ error: err } = await supabase.from('buckets').insert({ name: name.trim(), household_id: householdId, slug }))
    }
    setLoading(false)
    if (err) {
      setError(err.code === '23505' ? 'Grupa sa tim nazivom već postoji.' : err.message)
      return
    }
    closeForm(); router.refresh()
  }

  async function handleDeleteKeep(id: string) {
    setDeleting(true)
    await Promise.all([
      supabase.from('dugovi').update({ bucket_id: null }).eq('bucket_id', id),
      supabase.from('credits').update({ bucket_id: null }).eq('bucket_id', id),
      supabase.from('recurring_items').update({ bucket_id: null }).eq('bucket_id', id),
      supabase.from('transactions').update({ bucket_id: null }).eq('bucket_id', id),
      supabase.from('categories').update({ bucket_id: null }).eq('bucket_id', id),
    ])
    const { error: err } = await supabase.from('buckets').delete().eq('id', id)
    setDeleting(false)
    if (err) { setError(err.message); return }
    setConfirmDeleteId(null)
    router.refresh()
  }

  async function handleDeleteAll(id: string) {
    setDeleting(true)
    await supabase.from('transactions').delete().eq('bucket_id', id)
    await supabase.from('recurring_items').delete().eq('bucket_id', id)
    await supabase.from('credits').delete().eq('bucket_id', id)
    await supabase.from('dugovi').delete().eq('bucket_id', id)
    await supabase.from('categories').delete().eq('bucket_id', id)
    const { error: err } = await supabase.from('buckets').delete().eq('id', id)
    setDeleting(false)
    if (err) { setError(err.message); return }
    setConfirmDeleteAllId(null)
    setConfirmDeleteId(null)
    router.refresh()
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
                  <svg width="15" height="15" viewBox="0 0 39.3 39.3" fill="var(--text-3)">
                    <path d="M6.38,39.3c-1.77,0-3.27-.62-4.51-1.87s-1.87-2.75-1.87-4.52.62-3.27,1.87-4.51c1.25-1.24,2.75-1.87,4.52-1.87.62,0,1.21.08,1.77.25s1.08.39,1.57.69l8.45-8.4v-6.43c-1.41-.36-2.58-1.11-3.51-2.26s-1.4-2.47-1.4-3.98c0-1.76.62-3.27,1.87-4.52,1.25-1.25,2.75-1.87,4.52-1.87s3.27.62,4.51,1.87c1.24,1.25,1.87,2.75,1.87,4.52,0,1.51-.47,2.83-1.4,3.98-.93,1.15-2.1,1.9-3.51,2.26v6.43l8.45,8.4c.51-.29,1.04-.52,1.59-.69.56-.16,1.14-.25,1.75-.25,1.76,0,3.27.62,4.52,1.87,1.25,1.25,1.87,2.75,1.87,4.52s-.62,3.27-1.87,4.51-2.75,1.87-4.52,1.87-3.27-.62-4.51-1.87-1.87-2.75-1.87-4.52c0-.62.08-1.21.25-1.77s.39-1.08.69-1.57l-7.81-7.86-7.81,7.86c.29.49.52,1.02.69,1.57s.25,1.15.25,1.77c0,1.76-.62,3.27-1.87,4.52s-2.75,1.87-4.52,1.87ZM32.91,36.35c.95,0,1.77-.33,2.44-1,.67-.67,1.01-1.48,1.01-2.43s-.33-1.77-1-2.44c-.67-.67-1.48-1.01-2.43-1.01s-1.77.33-2.44,1c-.67.67-1.01,1.48-1.01,2.43s.33,1.77,1,2.44c.67.67,1.48,1.01,2.43,1.01ZM19.64,9.82c.95,0,1.77-.33,2.44-1,.67-.67,1.01-1.48,1.01-2.43s-.33-1.77-1-2.44c-.67-.67-1.48-1.01-2.43-1.01s-1.77.33-2.44,1c-.67.67-1.01,1.48-1.01,2.43s.33,1.77,1,2.44c.67.67,1.48,1.01,2.43,1.01ZM6.38,36.35c.95,0,1.77-.33,2.44-1,.67-.67,1.01-1.48,1.01-2.43s-.33-1.77-1-2.44-1.48-1.01-2.43-1.01-1.77.33-2.44,1c-.67.67-1.01,1.48-1.01,2.43s.33,1.77,1,2.44,1.48,1.01,2.43,1.01Z"/>
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

        {error && <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 10, padding: '0 4px' }}>{error}</p>}
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, padding: '0 4px' }}>
          Grupe organizuju transakcije, kategorije i mesečne račune po segmentima.
        </p>
      </div>

      {/* Delete — choose mode */}
      {confirmDeleteId && !confirmDeleteAllId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>Obriši grupu?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Odaberi šta se dešava sa stavkama u ovoj grupi.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>
                Otkaži
              </button>
              <button onClick={() => !deleting && handleDeleteKeep(confirmDeleteId)} disabled={deleting} style={{ padding: '13px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border-2)', background: 'var(--card)', color: 'var(--text-1)', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ marginBottom: 3 }}>Obriši samo grupu</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Sve stavke, troškovi i pozajmice ostaju bez grupe.</p>
              </button>
              <button onClick={() => setConfirmDeleteAllId(confirmDeleteId)} style={{ padding: '13px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ marginBottom: 3 }}>Obriši grupu i sve vezano</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>Briše se i sve kategorije, troškovi, računi, krediti i pozajmice.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete all — second confirm */}
      {confirmDeleteAllId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteAllId(null)}>
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--red)', marginBottom: 8 }}>Sigurno obrisati sve?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ovo trajno briše sve kategorije, troškove, mesečne račune, kredite i pozajmice za ovu grupu. Ne može se poništiti.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteAllId(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => !deleting && handleDeleteAll(confirmDeleteAllId)} disabled={deleting} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>
                {deleting ? 'Brisanje...' : 'Obriši sve'}
              </button>
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
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '13px 16px', fontSize: 14, color: 'var(--text-1)', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--card)', outline: 'none', fontFamily: 'inherit', marginBottom: 20 }}
            />
            {error && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
            <button onClick={handleSave} disabled={loading || !name.trim()} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
