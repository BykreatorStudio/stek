'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types'

export default function KategorijeClient({ categories }: { categories: Category[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catName, setCatName] = useState('')
  const [catType, setCatType] = useState<'prihod' | 'rashod'>('rashod')
  const [catCurrency, setCatCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteAllId, setConfirmDeleteAllId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const prihodi = categories.filter(c => c.type === 'prihod')
  const rashodi = categories.filter(c => c.type === 'rashod')

  function openAdd() {
    setEditingCat(null)
    setCatName(''); setCatType('rashod'); setCatCurrency('RSD')
    setShowForm(true)
  }
  function openEdit(cat: Category) {
    setEditingCat(cat)
    setCatName(cat.name); setCatType(cat.type); setCatCurrency(cat.currency_default)
    setShowForm(true)
  }
  function closeForm() {
    setShowForm(false); setEditingCat(null); setCatName('')
  }

  async function handleSave() {
    if (!catName.trim()) return
    setLoading(true)
    if (editingCat) {
      await supabase.from('categories').update({ name: catName.trim(), type: catType, currency_default: catCurrency }).eq('id', editingCat.id)
    } else {
      await supabase.from('categories').insert({ name: catName.trim(), type: catType, currency_default: catCurrency })
    }
    setLoading(false); closeForm(); router.refresh()
  }

  async function handleDeleteKeep(id: string) {
    setDeleting(true)
    await supabase.from('categories').update({ is_active: false }).eq('id', id)
    setDeleting(false)
    setConfirmDeleteId(null)
    router.refresh()
  }

  async function handleDeleteAll(id: string) {
    setDeleting(true)
    await supabase.from('transactions').delete().eq('category_id', id)
    await supabase.from('recurring_items').delete().eq('category_id', id)
    await supabase.from('categories').delete().eq('id', id)
    setDeleting(false)
    setConfirmDeleteAllId(null)
    setConfirmDeleteId(null)
    router.refresh()
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
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px',
                    borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 39.03 37.38" fill="none" stroke="var(--text-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M35.08,25.03c.7.42,1.29.79,1.77,1.1.9.59.9,1.81,0,2.41-1.38.91-3.66,2.27-6.96,3.84-4.21,2.01-7.59,2.97-9.25,3.36-.74.18-1.51.18-2.25,0-1.66-.4-5.04-1.36-9.25-3.36-3.3-1.57-5.58-2.93-6.96-3.84-.9-.59-.9-1.81,0-2.41.58-.38,1.17-.75,1.77-1.1" />
                        <path d="M35.08,16.28c.7.42,1.29.79,1.77,1.1.9.59.9,1.81,0,2.41-1.38.91-3.66,2.27-6.96,3.84-4.21,2.01-7.59,2.97-9.25,3.36-.74.18-1.51.18-2.25,0-1.66-.4-5.04-1.36-9.25-3.36-3.3-1.57-5.58-2.93-6.96-3.84-.9-.59-.9-1.81,0-2.41.58-.38,1.17-.75,1.77-1.1" />
                        <path d="M18.39,1.63c.74-.18,1.51-.18,2.25,0,1.66.4,5.04,1.36,9.25,3.36,3.3,1.57,5.58,2.93,6.96,3.84.9.59.9,1.81,0,2.41-1.38.91-3.66,2.27-6.96,3.84-4.21,2.01-7.59,2.97-9.25,3.36-.74.18-1.51.18-2.25,0-1.66-.4-5.04-1.36-9.25-3.36-3.3-1.57-5.58-2.93-6.96-3.84-.9-.59-.9-1.81,0-2.41,1.38-.91,3.66-2.27,6.96-3.84,4.21-2.01,7.59-2.97,9.25-3.36Z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{cat.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{cat.currency_default}</p>
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

      {confirmDeleteId && !confirmDeleteAllId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>Obriši kategoriju?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Odaberi šta se dešava sa troškovima u ovoj kategoriji.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>
                Otkaži
              </button>
              <button onClick={() => !deleting && handleDeleteKeep(confirmDeleteId)} disabled={deleting} style={{ padding: '13px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border-2)', background: 'var(--card)', color: 'var(--text-1)', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ marginBottom: 3 }}>Obriši samo kategoriju</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Svi troškovi ostaju vidljivi bez kategorije.</p>
              </button>
              <button onClick={() => setConfirmDeleteAllId(confirmDeleteId)} style={{ padding: '13px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ marginBottom: 3 }}>Obriši kategoriju i troškove</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>Briše se i svi troškovi i mesečni računi u ovoj kategoriji.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAllId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: '0 24px' }}
          onClick={() => setConfirmDeleteAllId(null)}>
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--card)', borderRadius: 20, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--red)', marginBottom: 8 }}>Sigurno obrisati sve?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ovo trajno briše sve troškove i mesečne račune u ovoj kategoriji. Ne može se poništiti.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteAllId(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer' }}>Otkaži</button>
              <button onClick={() => !deleting && handleDeleteAll(confirmDeleteAllId)} disabled={deleting} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>
                {deleting ? 'Brisanje...' : 'Obriši sve'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Naziv kategorije"
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
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
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
              {(['RSD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => setCatCurrency(c)} style={{ padding: '5px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid', borderColor: catCurrency === c ? 'var(--text-1)' : 'var(--border)', background: catCurrency === c ? 'var(--text-1)' : 'transparent', color: catCurrency === c ? '#fff' : 'var(--text-3)' }}>{c}</button>
              ))}
            </div>
            <button onClick={handleSave} disabled={loading || !catName.trim()} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
