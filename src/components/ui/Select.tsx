'use client'

import { useEffect, useRef, useState } from 'react'

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
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px', fontSize: 14, fontWeight: 400,
          color: 'var(--text-1)', fontFamily: 'inherit', cursor: 'pointer',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)', outline: 'none',
          textAlign: 'left',
        }}
      >
        <span>{selected?.label}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-3)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300,
          background: 'var(--card)',
          borderRadius: 12,
          maxHeight: 240,
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{
                width: '100%', padding: '13px 16px', fontSize: 14,
                fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                background: o.value === value ? 'var(--accent-light)' : 'transparent',
                color: o.value === value ? 'var(--accent-dark)' : 'var(--text-1)',
                fontWeight: o.value === value ? 500 : 400,
                border: 'none',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                display: 'block',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
