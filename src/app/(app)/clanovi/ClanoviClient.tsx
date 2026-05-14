'use client'

import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Member } from '@/types'
import { useHouseholdId } from '@/hooks/useHouseholdId'
import SwipeActions from '@/components/ui/SwipeActions'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function Avatar({ member, size = 44 }: { member: Pick<Member, 'name' | 'avatar_url'>; size?: number }) {
  if (member.avatar_url) {
    return <img src={member.avatar_url} alt={member.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--text-1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: Math.round(size * 0.38), fontWeight: 600, color: '#fff', lineHeight: 1 }}>
        {member.name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const householdId = useHouseholdId()
  const supabase = createClient()

  useEffect(() => {
    if (!code) return
    setSeconds(600)
    const iv = setInterval(() => setSeconds(s => {
      if (s <= 1) { clearInterval(iv); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(iv)
  }, [code])

  async function handleGenerate() {
    if (!email.trim() || !householdId) return
    setLoading(true); setError('')
    const newCode = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: err } = await supabase.from('invitations').insert({
      household_id: householdId,
      email: email.trim().toLowerCase(),
      code: newCode,
      expires_at: expiresAt,
    })
    if (err) { setError(err.message); setLoading(false); return }
    await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: newCode }),
    }).catch(() => {})
    setCode(newCode)
    setLoading(false)
  }

  function handleCopy() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const expired = seconds === 0 && code !== null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(36px + var(--safe-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 20 }}>Pozovi člana</p>

        {!code ? (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email adresa"
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              style={{ width: '100%', padding: '13px 16px', fontSize: 14, color: 'var(--text-1)', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--card)', outline: 'none', fontFamily: 'inherit', marginBottom: 12 }}
            />
            {error && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
            <button onClick={handleGenerate} disabled={loading || !email.trim()} className="btn-primary">
              {loading ? 'Generisanje...' : 'Generiši kod'}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
              Pošalji ovaj kod osobi na <strong style={{ color: 'var(--text-2)' }}>{email}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 14, padding: '16px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-1)', letterSpacing: 6, fontVariantNumeric: 'tabular-nums' }}>
                  {expired ? '——' : code}
                </p>
              </div>
              <button onClick={handleCopy} disabled={expired} style={{ padding: '14px 18px', borderRadius: 14, fontSize: 13, fontWeight: 500, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', cursor: expired ? 'default' : 'pointer', opacity: expired ? 0.4 : 1 }}>
                {copied ? 'Kopirano' : 'Kopiraj'}
              </button>
            </div>
            {expired ? (
              <p style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', marginBottom: 16 }}>Kod je istekao.</p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 16 }}>
                Ističe za {mins}:{String(secs).padStart(2, '0')}
              </p>
            )}
            <button onClick={onClose} style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
              Zatvori
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function RemoveMemberModal({ member, onClose, onConfirm }: { member: Member; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: '0 24px' }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 24, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Ukloni člana?</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
          {member.name} više neće imati pristup zajedničkim finansijama. Ova akcija se ne može vratiti.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, border: '1.5px solid var(--border-2)', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit' }}>Otkaži</button>
          <button onClick={handle} disabled={loading} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: 'none', background: 'var(--red)', cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}>
            {loading ? 'Uklanjanje...' : 'Ukloni'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LeaveModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  async function handleLeave() {
    setLoading(true)
    const res = await fetch('/api/delete-account', { method: 'POST' })
    if (!res.ok) { setLoading(false); return }
    window.location.href = '/login'
  }

  const emailMatch = email.trim().toLowerCase() === userEmail.toLowerCase()

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: '0 24px' }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 24, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8 }}>Napusti zajedničku štednju?</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
          Izgubićete pristup svim podacima — troškovima, štednji, pozajmicama i svemu ostalom. Ova akcija se ne može vratiti.
        </p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Unesite vaš email za potvrdu"
          style={{
            width: '100%', padding: '13px 16px', fontSize: 14,
            color: 'var(--text-1)', border: '1.5px solid var(--border)',
            borderRadius: 12, background: 'var(--bg-subtle)',
            outline: 'none', fontFamily: 'inherit', marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, border: '1.5px solid var(--border-2)', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'inherit' }}>Otkaži</button>
          <button onClick={handleLeave} disabled={loading || !emailMatch} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 500, border: 'none', background: emailMatch ? 'var(--red)' : 'var(--border-2)', cursor: emailMatch ? 'pointer' : 'default', color: emailMatch ? '#fff' : 'var(--text-3)', fontFamily: 'inherit', transition: 'background 0.15s' }}>
            {loading ? 'Izlaz...' : 'Napusti'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClanoviClient({ members, currentUserId, currentUserRole }: { members: Member[]; currentUserId: string; currentUserRole: string }) {
  const [editing, setEditing] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [removeMember, setRemoveMember] = useState<Member | null>(null)
  const [showLeave, setShowLeave] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  function openEdit(m: Member) {
    setEditing(m); setName(m.name); setAvatarUrl(m.avatar_url)
    setAvatarFile(null); setAvatarPreview(m.avatar_url); setShowForm(true)
  }
  function closeForm() {
    setShowForm(false); setEditing(null); setName('')
    setAvatarFile(null); setAvatarPreview(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file))
  }

  async function compressImage(file: File): Promise<Blob> {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 300
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.82)
      }
      img.src = url
    })
  }

  async function uploadAvatar(file: File, memberId: string): Promise<string | null> {
    const compressed = await compressImage(file)
    const path = `${memberId}.jpg`
    const { error } = await supabase.storage.from('member-avatars').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
    if (error) return null
    const { data } = supabase.storage.from('member-avatars').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }

  async function handleSave() {
    if (!name.trim() || !editing) return
    setLoading(true)
    let finalAvatarUrl = avatarUrl
    if (avatarFile) finalAvatarUrl = await uploadAvatar(avatarFile, editing.id)
    await supabase.from('members').update({ name: name.trim(), avatar_url: finalAvatarUrl }).eq('id', editing.id)
    setLoading(false); closeForm(); router.refresh()
  }

  const previewName = name || editing?.name || '?'
  const isOwner = currentUserRole === 'owner'

  async function handleRemoveMember(member: Member) {
    const res = await fetch('/api/admin/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: member.id, userId: member.user_id }),
    })
    if (!res.ok) { console.error('remove member error'); return }
    setRemoveMember(null)
    router.refresh()
  }

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <p className="section-label">Članovi</p>

        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {members.map(m => {
              const isMe = m.user_id === currentUserId
              const canRemove = isOwner && !isMe
              return (
                <SwipeActions
                  key={m.id}
                  actions={canRemove ? [{ label: 'Ukloni', color: 'danger', onClick: () => setRemoveMember(m) }] : []}
                  onTap={isMe ? () => openEdit(m) : undefined}
                  tapLabel="Izmeni"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar member={m} size={40} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{m.name}</p>
                        {isMe && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Vi</p>}
                        {isOwner && !isMe && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Član</p>}
                      </div>
                    </div>
                    {isMe && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    )}
                  </div>
                </SwipeActions>
              )
            })}
          </div>
        )}

      </div>

      <div style={{ position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)', left: 0, right: 0, padding: '0 16px', maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isOwner && (
          <button
            onClick={() => setShowLeave(true)}
            style={{
              width: '100%', padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 500,
              border: '1.5px solid var(--red)', background: 'transparent',
              cursor: 'pointer', color: 'var(--red)', fontFamily: 'inherit',
            }}
          >
            Napusti
          </button>
        )}
        {isOwner && (
          <button onClick={() => setShowInvite(true)} className="btn-primary" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            Dodaj člana
          </button>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {removeMember && (
        <RemoveMemberModal
          member={removeMember}
          onClose={() => setRemoveMember(null)}
          onConfirm={() => handleRemoveMember(removeMember)}
        />
      )}
      {showLeave && <LeaveModal onClose={() => setShowLeave(false)} />}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={closeForm}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(36px + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <div onClick={() => fileRef.current?.click()} style={{ position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', background: avatarPreview ? 'transparent' : 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 0 0 4px var(--card), 0 0 0 6px var(--border-2)' }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 38, fontWeight: 600, color: '#fff', lineHeight: 1 }}>{previewName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>Tapni za dodavanje fotografije</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ime člana" onKeyDown={e => e.key === 'Enter' && handleSave()} style={{ width: '100%', padding: '13px 16px', fontSize: 14, color: 'var(--text-1)', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--card)', outline: 'none', fontFamily: 'inherit', marginBottom: 24 }} />
            <button onClick={handleSave} disabled={loading || !name.trim()} className="btn-primary">
              {loading ? 'Čuvanje...' : 'Sačuvaj izmene'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
