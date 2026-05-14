'use client'

import { useState } from 'react'

type Option = { label: string; value: string }

export default function Select({
  value,
  onChange,
  options,
  style,
}: {
  value: string
  onChange: (value: string) => void
  options: Option[]
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value) ?? options[0]

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
          onClick={() => setOpen(false)}
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
                  onClick={() => { onChange(o.value); setOpen(false) }}
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
