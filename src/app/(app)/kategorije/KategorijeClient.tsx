'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket, Category } from '@/types'
import Select from '@/components/ui/Select'
export default function KategorijeClient({ buckets, categories }: { buckets: Bucket[], categories: Category[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catName, setCatName] = useState('')
  const [catType, setCatType] = useState<'prihod' | 'rashod'>('rashod')
  const [catCurrency, setCatCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [catBucketId, setCatBucketId] = useState(buckets[0]?.id ?? '')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const prihodi = categories.filter(c => c.type === 'prihod')
  const rashodi = categories.filter(c => c.type === 'rashod')

  function openAdd() {
    setEditingCat(null)
    setCatName(''); setCatType('rashod'); setCatCurrency('RSD'); setCatBucketId(buckets[0]?.id ?? '')
    setShowForm(true)
  }
  function openEdit(cat: Category) {
    setEditingCat(cat)
    setCatName(cat.name); setCatType(cat.type); setCatCurrency(cat.currency_default); setCatBucketId(cat.bucket_id)
    setShowForm(true)
  }
  function closeForm() {
    setShowForm(false); setEditingCat(null); setCatName('')
  }

  async function handleSave() {
    if (!catName.trim() || !catBucketId) return
    setLoading(true)
    if (editingCat) {
      await supabase.from('categories').update({ name: catName.trim(), type: catType, currency_default: catCurrency, bucket_id: catBucketId }).eq('id', editingCat.id)
    } else {
      await supabase.from('categories').insert({ bucket_id: catBucketId, name: catName.trim(), type: catType, currency_default: catCurrency })
    }
    setLoading(false); closeForm(); router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('categories').update({ is_active: false }).eq('id', id)
    setConfirmDeleteId(null); router.refresh()
  }

  function bucketName(id: string) {
    return buckets.find(b => b.id === id)?.name ?? ''
  }

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        {[
          { label: 'Rashodi', items: rashodi },
          { label: 'Prihodi', items: prihodi },
        ].map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <p className="section-label">{group.label}</p>
            {group.items.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Nema kategorija</p>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {group.items.map((cat, i) => (
                  <div key={cat.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{cat.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{bucketName(cat.bucket_id)} · {cat.currency_default}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <button onClick={() => openEdit(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                        Izmeni
                      </button>
                      <button onClick={() => setConfirmDeleteId(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>
                        Obriši
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FAB */}
      <button onClick={openAdd} style={{
        position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)', right: 20,
        width: 52, height: 52, borderRadius: 16,
        background: 'var(--text-1)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši kategoriju?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ova akcija se ne može poništiti.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {/* Category form sheet */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={closeForm}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>
              {editingCat ? 'Izmeni kategoriju' : 'Nova kategorija'}
            </p>
            <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Naziv kategorije" autoFocus
              style={{ width: '100%', padding: '13px 16px', fontSize: 14, color: 'var(--text-1)', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--card)', outline: 'none', fontFamily: 'inherit', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {([
                { t: 'rashod' as const, label: 'Rashod', color: '#d93025', bg: '#fdf0ee', d: 'M12 5v14M19 12l-7 7-7-7' },
                { t: 'prihod' as const, label: 'Prihod', color: '#6aaa00', bg: '#edf6d0', d: 'M12 19V5M5 12l7-7 7 7' },
              ]).map(({ t, label, color, bg, d }) => {
                const active = catType === t
                return (
                  <button key={t} onClick={() => setCatType(t)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: `1.5px solid ${active ? color : 'var(--border)'}`, background: active ? bg : 'var(--card)', cursor: 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? color : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: active ? color : 'var(--text-3)' }}>{label}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
              {(['RSD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => setCatCurrency(c)} style={{ padding: '5px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid', borderColor: catCurrency === c ? 'var(--text-1)' : 'var(--border)', background: catCurrency === c ? 'var(--text-1)' : 'transparent', color: catCurrency === c ? '#fff' : 'var(--text-3)' }}>{c}</button>
              ))}
            </div>
            <Select
              value={catBucketId}
              onChange={v => setCatBucketId(v)}
              options={buckets.map(b => ({ label: b.name, value: b.id }))}
              style={{ marginBottom: 20 }}
            />
            <button onClick={handleSave} disabled={loading || !catName.trim() || !catBucketId} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
