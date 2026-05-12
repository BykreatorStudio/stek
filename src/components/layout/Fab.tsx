'use client'

import { useState } from 'react'
import TransakcijaForm from '@/components/forms/TransakcijaForm'

export default function Fab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)',
          zIndex: 101,
          width: 52,
          height: 52,
          borderRadius: 16,
          background: 'var(--header-bg)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      {open && <TransakcijaForm onClose={() => setOpen(false)} />}
    </>
  )
}
