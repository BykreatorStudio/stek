'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import TransakcijaForm from '@/components/forms/TransakcijaForm'
import CekForm from '@/components/forms/CekForm'

const navLeft = [
  { href: '/dashboard', label: 'Početna', icon: 'M3 11L12 4l9 7M5 10v11h5v-6h4v6h5V10' },
  { href: '/troskovi', label: 'Troškovi', icon: 'M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4a2 2 0 00-2-2zM9 9h6M9 13h6M9 17h3' },
]

const navRight = [
  { href: '/cekovi', label: 'Čekovi', icon: 'M2 7h20v10H2zM7 7v10M10 11h7M10 14h4' },
  { href: '/vise', label: 'Više', icon: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z' },
]

type Mode = null | 'picker' | 'transakcija' | 'cek'

const PICKER_OPTIONS = [
  {
    key: 'transakcija' as const,
    label: 'Transakcija',
    desc: 'Prihod ili rashod',
    icon: 'M12 5v14M19 12l-7 7-7-7',
  },
  {
    key: 'cek' as const,
    label: 'Ček',
    desc: 'Ček na naplatu · 5.000 RSD',
    icon: 'M2 7h20v10H2zM7 7v10M10 11h7M10 14h4',
  },
]

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname()
  const active = href === '/dashboard'
    ? pathname === '/dashboard' || pathname === '/'
    : pathname.startsWith(href)

  return (
    <Link href={href} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 4,
      textDecoration: 'none',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--accent)' : '#c0c0c0'}
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, color: active ? 'var(--accent)' : '#c0c0c0' }}>
        {label}
      </span>
    </Link>
  )
}

function Picker({ onSelect, onClose }: { onSelect: (key: 'transakcija' | 'cek') => void; onClose: () => void }) {
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
          padding: '12px 0 calc(24px + var(--safe-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, padding: '0 20px', marginBottom: 8 }}>
          Dodaj stavku
        </p>

        {PICKER_OPTIONS.map((opt, i) => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-subtle)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={opt.icon} />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{opt.label}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{opt.desc}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BottomNav() {
  const [mode, setMode] = useState<Mode>(null)

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        zIndex: 100,
        paddingBottom: 'var(--safe-bottom)',
      }}>
        <div style={{ display: 'flex', height: 'var(--nav-height)', alignItems: 'center', maxWidth: 540, margin: '0 auto' }}>
          {navLeft.map(item => <NavItem key={item.href} {...item} />)}

          <button
            onClick={() => setMode('picker')}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="1.6" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 400, color: '#c0c0c0' }}>Dodaj</span>
          </button>

          {navRight.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </nav>

      {mode === 'picker' && (
        <Picker
          onSelect={key => setMode(key)}
          onClose={() => setMode(null)}
        />
      )}
      {mode === 'transakcija' && <TransakcijaForm onClose={() => setMode(null)} />}
      {mode === 'cek' && <CekForm onClose={() => setMode(null)} />}
    </>
  )
}
