'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket, Category, RecurringItem } from '@/types'
import Select from '@/components/ui/Select'
import AmountInput, { parseAmount, formatAmount } from '@/components/ui/AmountInput'

type Item = RecurringItem & { bucket?: { name: string }; category?: { name: string } }
type SimpleMember = { id: string; name: string }

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
}

const fieldCss: React.CSSProperties = {
  width: '100%', padding: '13px 16px', fontSize: 14,
  color: 'var(--text-1)', border: '1.5px solid var(--border)',
  borderRadius: 12, background: 'var(--card)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

export default function MesecniRacuniClient({
  buckets,
  categories,
  items,
  members,
  receivedItemIds,
}: {
  buckets: Bucket[]
  categories: Category[]
  items: Item[]
  members: SimpleMember[]
  receivedItemIds: string[]
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [formIsIncome, setFormIsIncome] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [receiveItem, setReceiveItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(false)
  const [receiveLoading, setReceiveLoading] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<'fiksni' | 'varijabilni'>('fiksni')
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [dueDay, setDueDay] = useState('1')

  const [receiveAmount, setReceiveAmount] = useState('')
  const [receiveCurrency, setReceiveCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [receiveMemberId, setReceiveMemberId] = useState('')

  const supabase = createClient()
  const router = useRouter()

  const filteredCats = categories.filter(c => c.bucket_id === bucketId)
  const incomeItems = items.filter(i => i.is_income)
  const expenseItems = items.filter(i => !i.is_income)
  const grouped = buckets
    .map(b => ({ bucket: b, items: expenseItems.filter(i => i.bucket_id === b.id) }))
    .filter(g => g.items.length > 0)

  function openAdd(isIncome: boolean) {
    setEditing(null)
    setFormIsIncome(isIncome)
    setName('')
    setType('fiksni')
    setBucketId(buckets[0]?.id ?? '')
    setCategoryId(categories.find(c => c.bucket_id === buckets[0]?.id)?.id ?? '')
    setAmount('')
    setCurrency('RSD')
    setDueDay('1')
    setFormOpen(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    setFormIsIncome(item.is_income)
    setName(item.name)
    setType(item.type)
    setBucketId(item.bucket_id ?? buckets[0]?.id ?? '')
    setCategoryId(item.category_id ?? '')
    setAmount(item.amount ? formatAmount(String(item.amount).replace('.', ',')) : '')
    setCurrency(item.currency)
    setDueDay(String(item.due_day))
    setFormOpen(true)
  }

  function openReceive(item: Item) {
    setReceiveItem(item)
    setReceiveAmount(item.amount ? formatAmount(String(item.amount).replace('.', ',')) : '')
    setReceiveCurrency(item.currency)
    setReceiveMemberId(members[0]?.id ?? '')
  }

  function handleBucketChange(id: string) {
    setBucketId(id)
    setCategoryId(categories.find(c => c.bucket_id === id)?.id ?? '')
  }

  async function handleSave() {
    if (!name.trim() || !dueDay) return
    const day = parseInt(dueDay)
    if (!day || day < 1 || day > 31) return
    if (!formIsIncome && (!bucketId || !categoryId)) return
    setLoading(true)

    const base = {
      name: name.trim(),
      amount: amount ? parseAmount(amount) : null,
      currency,
      due_day: day,
      is_active: true,
      is_income: formIsIncome,
    }

    const payload = formIsIncome
      ? { ...base, bucket_id: null, category_id: null, type: 'varijabilni' as const }
      : { ...base, type, bucket_id: bucketId, category_id: categoryId }

    if (editing) {
      await supabase.from('recurring_items').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('recurring_items').insert({ ...payload, notify_7_days: false, notify_3_days: false, notify_on_day: false })
    }
    setLoading(false)
    setFormOpen(false)
    router.refresh()
  }

  async function handleReceive() {
    if (!receiveItem) return
    const a = parseAmount(receiveAmount)
    if (!a || a <= 0) return
    setReceiveLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const d = new Date().toISOString().slice(0, 10)
    await supabase.from('transactions').insert({
      bucket_id: null,
      category_id: null,
      recurring_item_id: receiveItem.id,
      user_id: user!.id,
      member_id: receiveMemberId || null,
      name: receiveItem.name,
      type: 'prihod',
      amount: a,
      currency: receiveCurrency,
      date: d,
      month: d.slice(0, 7),
    })
    setReceiveLoading(false)
    setReceiveItem(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('recurring_items').update({ is_active: false }).eq('id', id)
    setConfirmDeleteId(null)
    router.refresh()
  }

  const currencyToggle = (cur: 'RSD' | 'EUR', setter: (c: 'RSD' | 'EUR') => void) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {(['RSD', 'EUR'] as const).map(c => (
        <button key={c} onClick={() => setter(c)} style={{
          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
          border: '1.5px solid',
          borderColor: cur === c ? 'var(--text-1)' : 'var(--border)',
          background: cur === c ? 'var(--text-1)' : 'transparent',
          color: cur === c ? '#fff' : 'var(--text-3)',
          fontFamily: 'inherit',
        }}>{c}</button>
      ))}
    </div>
  )

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        {/* Prihodi */}
        <p className="section-label">Prihodi</p>
        {incomeItems.length === 0 ? (
          <div className="card" style={{ padding: '20px', textAlign: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>Nema stalnih prihoda.</p>
            <button
              onClick={() => openAdd(true)}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              + Dodaj prihod
            </button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            {incomeItems.map((item, i) => {
              const received = receivedItemIds.includes(item.id)
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px',
                  borderBottom: i < incomeItems.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: received ? 'var(--accent-light)' : 'rgba(99,102,241,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={received ? 'var(--accent-dark)' : 'var(--accent)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {received
                        ? <path d="M20 6L9 17l-5-5" />
                        : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
                      }
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{item.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>do {item.due_day}.</span>
                      {item.amount != null && (
                        <span className="num" style={{ fontSize: 11, color: 'var(--accent)' }}>
                          +{fmt(item.amount)} {item.currency}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {received ? (
                      <span style={{
                        fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                        background: 'var(--accent-light)', color: 'var(--accent-dark)',
                      }}>Primljeno</span>
                    ) : (
                      <button
                        onClick={() => openReceive(item)}
                        style={{
                          fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                          border: '1.5px solid var(--accent)', background: 'transparent',
                          color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >Primljeno</button>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)', padding: 0, fontFamily: 'inherit' }}>Izmeni</button>
                      <button onClick={() => setConfirmDeleteId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--red)', padding: 0, fontFamily: 'inherit' }}>Obriši</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Rashodi */}
        {expenseItems.length === 0 ? (
          <>
            <p className="section-label">Rashodi</p>
            <div className="card" style={{ padding: '20px', textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nema mesečnih rashoda.</p>
            </div>
          </>
        ) : (
          grouped.map(({ bucket, items: bItems }) => (
            <div key={bucket.id} style={{ marginBottom: 20 }}>
              <p className="section-label">{bucket.name}</p>
              <div className="card" style={{ overflow: 'hidden' }}>
                {bItems.map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px',
                    borderBottom: i < bItems.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
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
                        <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--accent)', padding: 0, fontFamily: 'inherit' }}>Izmeni</button>
                        <button onClick={() => setConfirmDeleteId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--red)', padding: 0, fontFamily: 'inherit' }}>Obriši</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => openAdd(false)}
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Obriši stavku?</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ova akcija se ne može poništiti.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--card)',
                color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Otkaži</button>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              }}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {formOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setFormOpen(false)}
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

            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>
              {editing ? 'Izmeni stavku' : 'Nova stavka'}
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {([{ v: true, label: 'Prihod' }, { v: false, label: 'Rashod' }] as const).map(({ v, label }) => {
                const active = formIsIncome === v
                return (
                  <button key={String(v)} onClick={() => { if (!editing) setFormIsIncome(v) }} style={{
                    flex: 1, padding: '10px', borderRadius: 12,
                    border: `1.5px solid ${active ? 'var(--text-1)' : 'var(--border)'}`,
                    background: active ? 'var(--text-1)' : 'var(--card)',
                    color: active ? '#fff' : 'var(--text-2)',
                    cursor: editing ? 'default' : 'pointer',
                    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                  }}>{label}</button>
                )
              })}
            </div>

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={formIsIncome ? 'Naziv (npr. Plata, Honorar...)' : 'Naziv (npr. Struja, Kirija...)'}
              style={{ ...fieldCss, marginBottom: 10 }}
            />

            {!formIsIncome && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {([
                  { t: 'fiksni' as const, label: 'Fiksni', desc: 'Isti iznos' },
                  { t: 'varijabilni' as const, label: 'Varijabilni', desc: 'Iznos se menja' },
                ]).map(({ t, label, desc }) => {
                  const active = type === t
                  return (
                    <button key={t} onClick={() => setType(t)} style={{
                      flex: 1, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                      border: `1.5px solid ${active ? 'var(--text-1)' : 'var(--border)'}`,
                      background: active ? 'var(--text-1)' : 'var(--card)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: active ? '#fff' : 'var(--text-1)', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-3)' }}>{desc}</p>
                    </button>
                  )
                })}
              </div>
            )}

            {!formIsIncome && (
              <>
                <Select
                  value={bucketId}
                  onChange={handleBucketChange}
                  options={buckets.map(b => ({ label: b.name, value: b.id }))}
                  style={{ marginBottom: 10 }}
                />
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
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <AmountInput
                value={amount}
                onChange={setAmount}
                placeholder={formIsIncome || type === 'varijabilni' ? 'Iznos (opciono)' : 'Iznos'}
                className="num"
                style={{
                  flex: 1, padding: '13px 16px', fontSize: 14,
                  color: 'var(--text-1)', border: '1.5px solid var(--border)',
                  borderRadius: 12, background: 'var(--card)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              {currencyToggle(currency, setCurrency)}
            </div>

            <Select
              value={dueDay}
              onChange={setDueDay}
              options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. u mesecu` }))}
              style={{ marginBottom: 20 }}
            />

            <button
              onClick={handleSave}
              disabled={loading || !name.trim() || (!formIsIncome && !categoryId)}
              className="btn-primary"
            >
              {loading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}

      {/* Receive modal */}
      {receiveItem && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setReceiveItem(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: 540, background: 'var(--card)',
              borderRadius: '28px 28px 0 0',
              padding: '12px 20px calc(32px + var(--safe-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>

            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{receiveItem.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>Unesi primljeni iznos</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: members.length > 1 ? 12 : 16 }}>
              <AmountInput
                value={receiveAmount}
                onChange={setReceiveAmount}
                placeholder="Iznos"
                className="num"
                style={{
                  flex: 1, padding: '13px 16px', fontSize: 18, fontWeight: 500,
                  color: 'var(--text-1)', border: '1.5px solid var(--border)',
                  borderRadius: 12, background: 'var(--card)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              {currencyToggle(receiveCurrency, setReceiveCurrency)}
            </div>

            {members.length > 1 && (
              <Select
                value={receiveMemberId}
                onChange={setReceiveMemberId}
                options={members.map(m => ({ label: m.name, value: m.id }))}
                style={{ marginBottom: 16 }}
              />
            )}

            <button
              onClick={handleReceive}
              disabled={receiveLoading || !parseAmount(receiveAmount)}
              className="btn-primary"
            >
              {receiveLoading ? 'Čuvanje...' : 'Potvrdi'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
