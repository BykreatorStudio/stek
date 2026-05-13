'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Bucket, Category } from '@/types'
import Select from '@/components/ui/Select'
import CalendarPopup from '@/components/ui/CalendarPopup'
import AmountInput, { parseAmount } from '@/components/ui/AmountInput'
import { notifyHousehold } from '@/lib/notify'

function today() { return new Date().toISOString().split('T')[0] }

function fmtDate(v: string) {
  if (!v) return ''
  const d = new Date(v + 'T00:00:00')
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TransakcijaForm({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<'prihod' | 'rashod'>('rashod')
  const [name, setName] = useState('')
  const [bucketId, setBucketId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'RSD' | 'EUR'>('RSD')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [view, setView] = useState<'form' | 'calendar'>('form')
  const [currentMember, setCurrentMember] = useState<{ id: string; name: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, name').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
  }, [])

  useEffect(() => {
    supabase.from('buckets').select('*').order('name').then(({ data }) => {
      setBuckets(data ?? [])
      if (data?.[0]) setBucketId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!bucketId) return
    supabase.from('categories').select('*')
      .eq('bucket_id', bucketId).eq('type', type).eq('is_active', true).order('name')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (data?.[0]) { setCategoryId(data[0].id); setCurrency(data[0].currency_default) }
        else setCategoryId('')
      })
  }, [bucketId, type])

  async function handleSubmit() {
    if (!amount || !name.trim()) return
    if (type === 'rashod' && (!categoryId || !bucketId)) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const a = parseAmount(amount)
    await supabase.from('transactions').insert({
      bucket_id: type === 'rashod' ? bucketId : null,
      category_id: type === 'rashod' ? categoryId : null,
      user_id: user!.id,
      type, amount: a, currency,
      date, month: date.slice(0, 7), name: name.trim(), note: note.trim() || null,
    })
    const fmt = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
    const memberName = currentMember?.name ?? 'Neko'
    notifyHousehold({
      triggeredByMemberId: currentMember?.id,
      type: type === 'rashod' ? 'transakcija_rashod' : 'transakcija_prihod',
      title: type === 'rashod' ? 'Rashod' : 'Prihod',
      body: `${memberName} · ${name.trim()} · ${type === 'prihod' ? '+' : '-'}${fmt(a)} ${currency}`,
    })
    setLoading(false); onClose(); router.refresh()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--card)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        {view === 'calendar' ? (
          <div style={{ padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setView('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>Izaberi datum</span>
            </div>
            <CalendarPopup
              value={date}
              onChange={v => { setDate(v); setView('form') }}
              onClose={() => setView('form')}
              inline
            />
          </div>
        ) : (
        <div style={{ overflowY: 'auto', padding: '8px 20px', paddingBottom: 'calc(28px + var(--safe-bottom))' }}>

          {/* Tip — Rashod / Prihod */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {([
              { t: 'rashod', label: 'Rashod', color: '#d93025', bg: '#fdf0ee', d: 'M12 5v14M19 12l-7 7-7-7' },
              { t: 'prihod', label: 'Prihod', color: '#6aaa00', bg: '#edf6d0', d: 'M12 19V5M5 12l7-7 7 7' },
            ] as const).map(({ t, label, color, bg, d }) => {
              const active = type === t
              return (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  border: `1.5px solid ${active ? color : 'var(--border)'}`,
                  background: active ? bg : 'var(--card)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke={active ? color : 'var(--text-3)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={d} />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 500, color: active ? color : 'var(--text-3)' }}>{label}</span>
                </button>
              )
            })}
          </div>

          {/* Naziv */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Naziv (npr. Supermarket, Gorivo...)"
            style={{
              width: '100%', padding: '13px 16px', fontSize: 14,
              color: 'var(--text-1)', border: '1.5px solid var(--border)',
              borderRadius: 12, background: 'var(--card)',
              outline: 'none', fontFamily: 'inherit', marginBottom: 16,
            }}
          />

          {/* Iznos */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <AmountInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
              autoFocus
              className="num"
              style={{
                fontSize: 52, fontWeight: 500, color: 'var(--text-1)',
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'inherit', width: '100%', textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {(['RSD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  padding: '5px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: currency === c ? 'var(--text-1)' : 'var(--border)',
                  background: currency === c ? 'var(--text-1)' : 'transparent',
                  color: currency === c ? '#fff' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Grupa + Kategorija — samo za rashod */}
          {type === 'rashod' && (
            <>
              <Select
                value={bucketId}
                onChange={v => setBucketId(v)}
                options={buckets.map(b => ({ label: b.name, value: b.id }))}
                style={{ marginBottom: 10 }}
              />
              {categories.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0', marginBottom: 10 }}>
                  Nema kategorija — dodaj ih u Više → Kategorije
                </p>
              ) : (
                <Select
                  value={categoryId}
                  onChange={v => {
                    setCategoryId(v)
                    const cat = categories.find(c => c.id === v)
                    if (cat) setCurrency(cat.currency_default)
                  }}
                  options={categories.map(c => ({ label: c.name, value: c.id }))}
                  style={{ marginBottom: 10 }}
                />
              )}
            </>
          )}

          {/* Datum */}
          <button
            onClick={() => setView('calendar')}
            style={{
              width: '100%', padding: '13px 16px', marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1.5px solid var(--border)', borderRadius: 12,
              background: 'var(--card)', cursor: 'pointer',
              fontSize: 14, color: 'var(--text-1)', fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span>{fmtDate(date)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>

          {/* Napomena */}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Napomena (opciono)"
            style={{
              width: '100%', padding: '13px 16px', fontSize: 14,
              color: 'var(--text-1)', border: '1.5px solid var(--border)',
              borderRadius: 12, background: 'var(--card)',
              outline: 'none', fontFamily: 'inherit', marginBottom: 20,
            }}
          />

          <button onClick={handleSubmit} disabled={loading || !parseAmount(amount) || !name.trim() || (type === 'rashod' && !categoryId)} className="btn-primary">
            {loading ? 'Čuvanje...' : 'Dodaj'}
          </button>
        </div>
        )}
      </div>
    </div>
  )
}
