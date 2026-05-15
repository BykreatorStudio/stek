'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

type Category = { id: string; name: string }
type Bucket = { id: string; name: string }
type ScannedItem = {
  name: string; quantity: number; unit: string; unitPrice: number; total: number
  categoryId: string
}
type View = 'scanning' | 'loading' | 'review' | 'saving' | 'error'

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
}

function CategoryPicker({ categories, value, onChange, onAdd }: {
  categories: Category[]; value: string; onChange: (id: string) => void
  onAdd?: (name: string) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const current = categories.find(c => c.id === value)

  async function handleAdd() {
    if (!newName.trim() || !onAdd) return
    setSaving(true)
    const id = await onAdd(newName.trim())
    setSaving(false)
    if (id) { onChange(id); setOpen(false); setAddingNew(false); setNewName('') }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          border: '1.5px solid var(--border)', background: value ? 'var(--accent-light)' : 'var(--card)',
          color: value ? 'var(--accent-dark)' : 'var(--text-3)', cursor: 'pointer',
          whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {current?.name || 'Kategorija'}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
          onClick={() => { setOpen(false); setAddingNew(false); setNewName('') }}
        >
          <div
            style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '20px 20px 0 0', maxHeight: '70dvh', overflowY: 'auto', paddingBottom: 'calc(20px + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 32, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            {categories.map(c => (
              <div
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false) }}
                style={{
                  padding: '14px 20px', fontSize: 14, cursor: 'pointer',
                  color: c.id === value ? 'var(--accent-dark)' : 'var(--text-1)',
                  fontWeight: c.id === value ? 500 : 400,
                  background: c.id === value ? 'var(--accent-light)' : 'transparent',
                }}
              >
                {c.name}
              </div>
            ))}
            {onAdd && !addingNew && (
              <div
                onClick={() => setAddingNew(true)}
                style={{ padding: '14px 20px', fontSize: 13, color: 'var(--accent-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Dodaj kategoriju
              </div>
            )}
            {onAdd && addingNew && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Naziv kategorije"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14,
                    border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-1)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || saving}
                  style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer',
                    opacity: !newName.trim() || saving ? 0.5 : 1,
                  }}
                >
                  {saving ? '...' : 'Dodaj'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function QrScannerForm({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('scanning')
  const [error, setError] = useState('')
  const [items, setItems] = useState<ScannedItem[]>([])
  const [merchantName, setMerchantName] = useState('')
  const [bucketId, setBucketId] = useState('')
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [currentMember, setCurrentMember] = useState<{ id: string; household_id: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const categoriesRef = useRef<Category[]>([])

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, household_id').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setCurrentMember(data) })
    })
    supabase.from('buckets').select('id, name').order('name').then(({ data }) => {
      setBuckets(data ?? [])
      if (data?.[0]) setBucketId(data[0].id)
    })
    supabase.from('categories').select('id, name').eq('type', 'rashod').eq('is_active', true).order('name')
      .then(({ data }) => {
        const cats = data ?? []
        setCategories(cats)
        categoriesRef.current = cats
      })
  }, [])

  const handleQrDetected = useCallback(async (qrUrl: string) => {
    setView('loading')
    try {
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: qrUrl }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Greška pri čitanju računa')
        setView('error')
        return
      }
      if (!data.items?.length) {
        console.error('[scan-receipt] no items. debug:', data._debug)
        setError(`Nisu pronađene stavke na računu.${data._debug ? `\n\nDebug: ${data._debug}` : ''}`)
        setView('error')
        return
      }
      setMerchantName(data.merchantName || '')

      const cats = categoriesRef.current
      // suggestions is an array — one category ID per item at the same index
      let suggestions: string[] = []
      if (cats.length > 0) {
        try {
          const catRes = await fetch('/api/categorize-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemNames: data.items.map((i: any) => i.name),
              categories: cats.map(c => ({ id: c.id, name: c.name })),
            }),
          })
          const catData = await catRes.json()
          suggestions = Array.isArray(catData.suggestions) ? catData.suggestions : []
        } catch {}
      }

      setItems(data.items.map((item: any, i: number) => ({
        ...item,
        categoryId: suggestions[i] || '',
      })))
      setView('review')
    } catch {
      setError('Greška pri komunikaciji sa serverom')
      setView('error')
    }
  }, [])

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setView('loading')

    try {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })

      if (code?.data.includes('suf.purs.gov.rs')) {
        handleQrDetected(code.data)
      } else {
        setError('QR kod nije pronađen na fotografiji. Usmeri kameru direktno na QR kod i pokušaj ponovo.')
        setView('error')
      }
    } catch {
      setError('Greška pri obradi fotografije.')
      setView('error')
    }
  }

  useEffect(() => {
    if (view !== 'scanning') return

    let active = true
    let stream: MediaStream | null = null
    let scanTimer: ReturnType<typeof setTimeout> | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        scheduleNextScan()
      } catch {
        if (active) {
          setError('Nije moguće pristupiti kameri. Dozvoli pristup u podešavanjima browsera.')
          setView('error')
        }
      }
    }

    function scheduleNextScan() {
      scanTimer = setTimeout(scan, 250)
    }

    async function scan() {
      if (!active) return

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        scheduleNextScan()
        return
      }

      // Try BarcodeDetector first (Chrome/Android — same engine as native camera)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          const codes = await detector.detect(video)
          const match = codes.find((c: any) => c.rawValue?.includes('suf.purs.gov.rs'))
          if (match) { handleQrDetected(match.rawValue); return }
        } catch {}
      } else {
        // Fallback: jsQR via canvas
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
        if (code?.data.includes('suf.purs.gov.rs')) { handleQrDetected(code.data); return }
      }

      scheduleNextScan()
    }

    startCamera()

    return () => {
      active = false
      if (scanTimer) clearTimeout(scanTimer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [view, handleQrDetected])

  async function handleSave() {
    if (!items.length || !bucketId || !currentMember) return
    setView('saving')
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]
    const month = today.slice(0, 7)
    const totalAmount = items.reduce((s, i) => s + i.total, 0)

    const { data: receipt, error } = await supabase.from('receipts').insert({
      household_id: currentMember.household_id,
      merchant_name: merchantName || 'Fiskalni račun',
      total_amount: totalAmount,
      date: today,
      month,
      bucket_id: bucketId,
    }).select('id').single()

    if (error || !receipt) {
      setError('Greška pri čuvanju računa.')
      setView('error')
      return
    }

    const rows = items.map(item => ({
      user_id: user!.id,
      member_id: currentMember.id,
      bucket_id: bucketId,
      category_id: item.categoryId || null,
      type: 'rashod',
      name: item.name,
      amount: item.total,
      currency: 'RSD',
      date: today,
      month,
      skip_accounting: alreadyPaid,
      note: merchantName || null,
      receipt_id: receipt.id,
    }))
    await supabase.from('transactions').insert(rows)
    onClose()
    router.refresh()
  }

  const total = items.reduce((s, i) => s + i.total, 0)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: view === 'scanning' ? '#000' : 'rgba(0,0,0,0.35)',
        backdropFilter: view === 'scanning' ? 'none' : 'blur(6px)',
      }}
      onClick={view === 'scanning' ? undefined : onClose}
    >
      {view === 'scanning' && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{
              width: 240, height: 240, borderRadius: 20,
              border: '3px solid var(--accent)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }} />
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 500, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              Usmeri kameru ka QR kodu<br />
              <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>na fiskalnom računu</span>
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 'calc(20px + var(--safe-top, 0px))', right: 20, zIndex: 3,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Photo capture fallback */}
          <div style={{ position: 'absolute', bottom: 'calc(40px + var(--safe-bottom))', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Skener ne radi?</p>
            <label style={{
              padding: '10px 22px', borderRadius: 24, fontSize: 14, fontWeight: 500,
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}>
              Fotografišui QR kod
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoCapture}
              />
            </label>
          </div>
        </div>
      )}

      {view === 'loading' && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#fff', fontSize: 14 }}>Učitavanje računa...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {view === 'error' && (
        <div
          style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', padding: '28px 24px calc(32px + var(--safe-bottom))' }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Greška</p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Zatvori
            </button>
            <button onClick={() => setView('scanning')} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Pokušaj ponovo
            </button>
          </div>
        </div>
      )}

      {view === 'review' && (
        <div
          style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
          </div>
          <div style={{ padding: '8px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{merchantName || 'Fiskalni račun'}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{items.length} stavki · {fmt(total)} RSD</p>
          </div>
          <div style={{ padding: '12px 20px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Grupa za sve stavke</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {buckets.map(b => (
                <button
                  key={b.id}
                  onClick={() => setBucketId(b.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: bucketId === b.id ? 'var(--text-1)' : 'var(--border)',
                    background: bucketId === b.id ? 'var(--text-1)' : 'transparent',
                    color: bucketId === b.id ? '#fff' : 'var(--text-2)',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <CategoryPicker
                    categories={categories}
                    value={item.categoryId}
                    onChange={id => setItems(prev => prev.map((it, j) => j === i ? { ...it, categoryId: id } : it))}
                    onAdd={async (name) => {
                      const { data: inserted } = await supabase.from('categories')
                        .insert({ name, type: 'rashod', is_active: true })
                        .select('id').single()
                      if (inserted?.id) {
                        const newCat = { id: inserted.id, name }
                        const updated = [...categoriesRef.current, newCat].sort((a, b) => a.name.localeCompare(b.name))
                        setCategories(updated)
                        categoriesRef.current = updated
                        return inserted.id
                      }
                      return null
                    }}
                  />
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p className="num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{fmt(item.total)}</p>
                  {item.quantity !== 1 && <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.quantity} × {fmt(item.unitPrice)}</p>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 20px', paddingBottom: 'calc(14px + var(--safe-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div onClick={() => setAlreadyPaid(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, cursor: 'pointer' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Označi kao plaćeno</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Ne utiče na dostupno ovog meseca</p>
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 13, background: alreadyPaid ? 'var(--accent)' : 'var(--border-2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: alreadyPaid ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
              </div>
            </div>
            <button onClick={handleSave} disabled={!bucketId} className="btn-primary">
              Dodaj {items.length} {items.length === 1 ? 'stavku' : items.length < 5 ? 'stavke' : 'stavki'} · {fmt(total)} RSD
            </button>
          </div>
        </div>
      )}

      {view === 'saving' && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#fff', fontSize: 14 }}>Dodavanje transakcija...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
