'use client'

import { useEffect, useState } from 'react'
import { Logomark } from '@/components/ui/AuthLogo'

const STORAGE_KEY = 'stedisa_install_dismissed'

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
  return isIOS && isSafari
}

function isStandalone() {
  if (typeof navigator === 'undefined') return false
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

const steps = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
    label: 'Tapni Share dugme',
    sub: 'Na dnu Safari pregledača',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    label: 'Dodaj na početni ekran',
    sub: 'Skroluj dole u listi opcija',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    label: 'Tapni "Dodaj"',
    sub: 'Gore desno u dijalogu',
  },
]

export default function IOSInstallGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return
    if (localStorage.getItem(STORAGE_KEY)) return
    const t = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.3)' }}
        onClick={dismiss}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: 'var(--card)',
        borderRadius: '24px 24px 0 0',
        padding: '16px 20px calc(28px + var(--safe-bottom))',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logomark size={40} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>Dodaj na početni ekran</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Brz pristup kao prava aplikacija</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{
              width: 28, height: 28, borderRadius: 50, border: 'none', cursor: 'pointer',
              background: 'var(--bg-subtle)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, lineHeight: 1, flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-2)',
              }}>
                {step.icon}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{step.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{step.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow pointing down toward Safari toolbar */}
        <div style={{
          marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Share dugme je ovde ↓</p>
        </div>
      </div>
    </>
  )
}
