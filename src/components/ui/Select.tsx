'use client'

import { useState } from 'react'

type Option = { label: string; value: string }

export default function Select({
  value,
  onChange,
  options,
  style,
  onAdd,
}: {
  value: string
  onChange: (value: string) => void
  options: Option[]
  style?: React.CSSProperties
  onAdd?: (name: string) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = options.find(o => o.value === value) ?? options[0]

  function handleClose() {
    setOpen(false)
    setAddingNew(false)
    setNewName('')
  }

  async function handleAdd() {
    if (!newName.trim() || !onAdd) return
    setSaving(true)
    const id = await onAdd(newName.trim())
    setSaving(false)
    if (id) { onChange(id); handleClose() }
  }

  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px', fontSize: 14, fontWeight: 400,
          color: 'var(--text-1)', fontFamily: 'inherit', cursor: 'pointer',
          border: '1.5px solid var(--border)', borderRadius: 12,
          background: 'var(--card)', outline: 'none', textAlign: 'left',
        }}
      >
        <span>{selected?.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
          }}
          onClick={handleClose}
        >
          <div
            style={{
              width: '100%', maxWidth: 540,
              background: 'var(--card)', borderRadius: '28px 28px 0 0',
              maxHeight: '70dvh', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            <div style={{ overflowY: 'auto', paddingBottom: 'calc(16px + var(--safe-bottom))' }}>
              {options.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); handleClose() }}
                  style={{
                    width: '100%', padding: '16px 20px', fontSize: 14,
                    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'transparent',
                    color: o.value === value ? 'var(--accent-dark)' : 'var(--text-1)',
                    fontWeight: o.value === value ? 500 : 400,
                    border: 'none',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === value && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}

              {onAdd && !addingNew && (
                <button
                  type="button"
                  onClick={() => setAddingNew(true)}
                  style={{
                    width: '100%', padding: '16px 20px', fontSize: 14,
                    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'transparent', border: 'none',
                    borderTop: options.length > 0 ? '1px solid var(--border)' : 'none',
                    color: 'var(--accent-dark)',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  <span>Dodaj kategoriju</span>
                </button>
              )}

              {onAdd && addingNew && (
                <div style={{ padding: '12px 16px', borderTop: options.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 8 }}>
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
                    type="button"
                    onClick={handleAdd}
                    disabled={!newName.trim() || saving}
                    style={{
                      padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                      border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer',
                      opacity: !newName.trim() || saving ? 0.5 : 1, fontFamily: 'inherit',
                    }}
                  >
                    {saving ? '...' : 'Dodaj'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
