'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket, Category, RecurringItem } from '@/types'
import Select from '@/components/ui/Select'
import AmountInput, { parseAmount, formatAmount } from '@/components/ui/AmountInput'

type Item = RecurringItem & { bucket?: { name: string }; category?: { name: string } }

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
}

export default function MesecniRacuniClient({
  buckets,
  categories,
  items,
}: {
  buckets: Bucket[]
  categories: Category[]
  items: Item[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<'fiksni' | 'varijabilni'>('fiksni')
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [dueDay, setDueDay] = useState('1')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const filteredCats = categories.filter(c => c.bucket_id === bucketId)

  function openAdd() {
    setEditing(null)
    setName(''); setType('fiksni'); setBucketId(buckets[0]?.id ?? '')
    const firstCat = categories.find(c => c.bucket_id === buckets[0]?.id)
    setCategoryId(firstCat?.id ?? '')
    setAmount(''); setCurrency('RSD'); setDueDay('1')
    setShowForm(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    setName(item.name); setType(item.type); setBucketId(item.bucket_id)
    setCategoryId(item.category_id); setAmount(item.amount ? formatAmount(String(item.amount).replace('.', ',')) : '')
    setCurrency(item.currency); setDueDay(String(item.due_day))
    setShowForm(true)
  }

  function handleBucketChange(id: string) {
    setBucketId(id)
    const firstCat = categories.find(c => c.bucket_id === id)
    setCategoryId(firstCat?.id ?? '')
  }

  async function handleSave() {
    if (!name.trim() || !bucketId || !categoryId || !dueDay) return
    const day = parseInt(dueDay)
    if (!day || day < 1 || day > 31) return
    setLoading(true)
    const payload = {
      name: name.trim(),
      type,
      bucket_id: bucketId,
      category_id: categoryId,
      amount: amount ? parseAmount(amount) : null,
      currency,
      due_day: day,
      is_active: true,
    }
    if (editing) {
      await supabase.from('recurring_items').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('recurring_items').insert({ ...payload, notify_7_days: false, notify_3_days: false, notify_on_day: false })
    }
    setLoading(false); setShowForm(false); router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('recurring_items').update({ is_active: false }).eq('id', id)
    setConfirmDeleteId(null)
    router.refresh()
  }

  const grouped = buckets.map(b => ({
    bucket: b,
    items: items.filter(i => i.bucket_id === b.id),
  })).filter(g => g.items.length > 0)

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        {items.length === 0 ? (
          <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema mesečnih računa. Dodaj prvi.</p>
          </div>
        ) : (
          grouped.map(({ bucket, items: bItems }) => (
            <div key={bucket.id} style={{ marginBottom: 20 }}>
              <p className="section-label">{bucket.name}</p>
              <div className="card" style={{ overflow: 'hidden' }}>
                {bItems.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 20px',
                      borderBottom: i < bItems.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 39.56 39.77" fill="none" stroke="var(--text-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7.02,38.27h27.36c2.03,0,3.68-1.65,3.68-3.68V10.69L28.86,1.5H10.69c-2.03,0-3.68,1.65-3.68,3.68v7.35" />
                        <path d="M27.03,1.5v7.35c0,2.03,1.65,3.68,3.68,3.68h7.35" />
                        <path d="M1.5,25.4h11.03" />
                        <path d="M7.02,19.89v11.03" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{item.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20,
                          background: item.type === 'fiksni' ? 'var(--bg-subtle)' : '#fff3e0',
                          color: item.type === 'fiksni' ? 'var(--text-2)' : '#c46000',
                          border: '1px solid',
                          borderColor: item.type === 'fiksni' ? 'var(--border-2)' : '#ffd8a8',
                        }}>
                          {item.type === 'fiksni' ? 'Fiksni' : 'Varijabilni'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>do {item.due_day}.</span>
                        {item.category?.name && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {item.category.name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {item.amount ? (
                        <p className="num" style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>
                          {fmt(item.amount)}
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, opacity: 0.5 }}>{item.currency}</span>
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Varijabilno</p>
                      )}
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--accent)', padding: 0 }}>
                          Izmeni
                        </button>
                        <button onClick={() => setConfirmDeleteId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--red)', padding: 0 }}>
                          Obriši
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)', padding: '0 24px',
        }} onClick={() => setConfirmDeleteId(null)}>
          <div style={{
            width: '100%', maxWidth: 340, background: 'var(--card)',
            borderRadius: 20, padding: '24px 20px',
          }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši mesečni račun?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ova akcija se ne može poništiti.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--card)',
                color: 'var(--text-2)', cursor: 'pointer',
              }}>Otkaži</button>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer',
              }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)', right: 20,
          width: 52, height: 52, borderRadius: 16,
          background: 'var(--text-1)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Form */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 540, background: 'var(--card)',
              borderRadius: '28px 28px 0 0',
              maxHeight: '90dvh', overflowY: 'auto',
              padding: '12px 20px calc(32px + var(--safe-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>

            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>
              {editing ? 'Izmeni račun' : 'Novi mesečni račun'}
            </p>

            {/* Naziv */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Naziv (npr. Struja, Kirija...)"
              style={{
                width: '100%', padding: '13px 16px', fontSize: 14,
                color: 'var(--text-1)', border: '1.5px solid var(--border)',
                borderRadius: 12, background: 'var(--card)',
                outline: 'none', fontFamily: 'inherit', marginBottom: 10,
              }}
            />

            {/* Tip */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {([
                { t: 'fiksni' as const, label: 'Fiksni', desc: 'Isti iznos svaki mesec' },
                { t: 'varijabilni' as const, label: 'Varijabilni', desc: 'Iznos se menja' },
              ]).map(({ t, label, desc }) => {
                const active = type === t
                return (
                  <button key={t} onClick={() => setType(t)} style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                    border: `1.5px solid ${active ? 'var(--text-1)' : 'var(--border)'}`,
                    background: active ? 'var(--text-1)' : 'var(--card)',
                    cursor: 'pointer',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: active ? '#fff' : 'var(--text-1)', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-3)' }}>{desc}</p>
                  </button>
                )
              })}
            </div>

            {/* Grupa */}
            <Select
              value={bucketId}
              onChange={handleBucketChange}
              options={buckets.map(b => ({ label: b.name, value: b.id }))}
              style={{ marginBottom: 10 }}
            />

            {/* Kategorija */}
            {filteredCats.length > 0 ? (
              <Select
                value={categoryId}
                onChange={setCategoryId}
                options={filteredCats.map(c => ({ label: c.name, value: c.id }))}
                style={{ marginBottom: 10 }}
              />
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0', marginBottom: 10 }}>
                Nema kategorija za ovu kasu
              </p>
            )}

            {/* Iznos + valuta */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <AmountInput
                value={amount}
                onChange={setAmount}
                placeholder={type === 'varijabilni' ? 'Iznos (opciono)' : 'Iznos'}
                className="num"
                style={{
                  flex: 1, padding: '13px 16px', fontSize: 14,
                  color: 'var(--text-1)', border: '1.5px solid var(--border)',
                  borderRadius: 12, background: 'var(--card)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(['RSD', 'EUR'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: currency === c ? 'var(--text-1)' : 'var(--border)',
                    background: currency === c ? 'var(--text-1)' : 'transparent',
                    color: currency === c ? '#fff' : 'var(--text-3)',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <Select
              value={dueDay}
              onChange={setDueDay}
              options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. u mesecu` }))}
              style={{ marginBottom: 20 }}
            />

            <button
              onClick={handleSave}
              disabled={loading || !name.trim() || !categoryId}
              className="btn-primary"
            >
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
