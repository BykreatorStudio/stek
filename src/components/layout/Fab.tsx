'use client'

import { useState } from 'react'
import TransakcijaForm from '@/components/forms/TransakcijaForm'
import QrScannerForm from '@/components/forms/QrScannerForm'

export default function Fab() {
  const [open, setOpen] = useState<null | 'manual' | 'qr'>(null)
  const [expanded, setExpanded] = useState(false)

  function handleOpen(type: 'manual' | 'qr') {
    setExpanded(false)
    setOpen(type)
  }

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onClick={() => setExpanded(false)}
        />
      )}

      <div style={{
        position: 'fixed',
        right: 20,
        bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}>

        {/* Sub-buttons */}
        {expanded && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeSlideUp 0.15s ease' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                Skeniraj račun
              </span>
              <button
                onClick={() => handleOpen('qr')}
                style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: 'var(--accent)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3M21 14v2" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeSlideUp 0.2s ease' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                Ručno unesi
              </span>
              <button
                onClick={() => handleOpen('manual')}
                style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: 'var(--header-bg)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--header-bg)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {open === 'manual' && <TransakcijaForm onClose={() => setOpen(null)} />}
      {open === 'qr' && <QrScannerForm onClose={() => setOpen(null)} />}
    </>
  )
}
