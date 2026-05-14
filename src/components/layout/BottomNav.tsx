'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import TransakcijaForm from '@/components/forms/TransakcijaForm'
import CekForm from '@/components/forms/CekForm'

type NavItemDef = { href: string; label: string; icon: (active: boolean) => React.ReactNode }

const navLeft: NavItemDef[] = [
  {
    href: '/dashboard',
    label: 'Početna',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 36.31 40" fill={active ? 'var(--accent)' : '#c0c0c0'}>
        <path d="M3.4,36.6h8.51v-12.48c0-.48.16-.89.49-1.21.33-.33.73-.49,1.21-.49h9.08c.48,0,.89.16,1.21.49.33.33.49.73.49,1.21v12.48h8.51V14.47L18.16,3.4,3.4,14.47v22.13ZM0,36.6V14.47c0-.54.12-1.05.36-1.53.24-.48.57-.88,1-1.19L16.11.68c.59-.45,1.27-.68,2.03-.68s1.45.23,2.05.68l14.75,11.06c.43.31.76.71,1,1.19.24.48.36.99.36,1.53v22.13c0,.94-.33,1.74-1,2.4-.67.67-1.47,1-2.4,1h-10.21c-.48,0-.89-.16-1.21-.49-.33-.33-.49-.73-.49-1.21v-12.48h-5.67v12.48c0,.48-.16.89-.49,1.21s-.73.49-1.21.49H3.4c-.94,0-1.74-.33-2.4-1-.67-.67-1-1.47-1-2.4Z" />
      </svg>
    ),
  },
  {
    href: '/troskovi',
    label: 'Troškovi',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 31.27 39.34" fill="none" stroke={active ? 'var(--accent)' : '#c0c0c0'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.66,1.5v8.06c0,1.11.9,2.02,2.02,2.02h8.06" />
        <path d="M29.74,19.64v14.11c.25,1.97-1.15,3.76-3.11,4.01-1.18.15-2.35-.3-3.13-1.18-1.13-1.45-3.22-1.7-4.67-.57-.21.17-.41.36-.57.57-1.13,1.45-3.22,1.7-4.67.57-.21-.17-.41-.36-.57-.57-1.13-1.45-3.22-1.7-4.67.57-.21.17-.41.36-.57.57-1.31,1.48-3.58,1.62-5.06.31-.89-.78-1.33-1.96-1.18-3.13V5.53C1.53,3.3,3.33,1.5,5.56,1.5h14.11l10.08,10.08v8.56" />
      </svg>
    ),
  },
]

const navRight: NavItemDef[] = [
  {
    href: '/stednja',
    label: 'Štednja',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 40 38" fill={active ? 'var(--accent)' : '#c0c0c0'}>
        <path d="M7.5,38c-.7,0-1.36-.23-1.97-.7-.62-.47-1.02-1.03-1.23-1.7-.83-2.87-1.53-5.34-2.08-7.42-.55-2.08-.99-3.91-1.32-5.48-.33-1.57-.56-2.97-.7-4.19-.14-1.22-.21-2.39-.21-3.5,0-3.07,1.07-5.67,3.2-7.8,2.13-2.13,4.73-3.2,7.8-3.2h10c.9-1.2,2.04-2.17,3.42-2.9,1.38-.73,2.91-1.1,4.58-1.1.83,0,1.54.29,2.12.88s.88,1.29.88,2.12c0,.2-.03.4-.08.6s-.11.38-.17.55c-.13.37-.26.73-.38,1.1-.12.37-.21.77-.28,1.2l4.55,4.55h2.85c.42,0,.78.14,1.07.43.29.29.43.64.43,1.07v11.35c0,.34-.09.64-.28.91-.18.26-.44.44-.78.54l-4.6,1.51-2.7,9.03c-.2.65-.56,1.18-1.09,1.57-.53.39-1.13.58-1.81.58h-5.75c-.83,0-1.53-.29-2.12-.88-.59-.59-.88-1.29-.88-2.12v-1h-4v1c0,.83-.29,1.53-.88,2.12-.59.59-1.29.88-2.12.88h-5.5ZM7.25,35h5.75v-4h10v4h5.75l3.15-10.5,5.1-1.75v-8.75h-2.6l-6.4-6.4c.03-.57.12-1.26.28-2.07.15-.82.36-1.72.62-2.72-1.43.37-2.7.92-3.8,1.65-1.1.73-1.9,1.58-2.4,2.55h-11.7c-2.21,0-4.1.78-5.66,2.34-1.56,1.56-2.34,3.45-2.34,5.66,0,1.4.37,3.84,1.1,7.33.73,3.48,1.78,7.71,3.15,12.67ZM28,18c.57,0,1.04-.19,1.42-.58s.58-.86.58-1.42-.19-1.04-.58-1.42-.86-.58-1.42-.58-1.04.19-1.42.58-.58.86-.58,1.42.19,1.04.58,1.42.86.58,1.42.58ZM20.5,13c.42,0,.78-.14,1.07-.43.29-.29.43-.65.43-1.07s-.14-.78-.43-1.07c-.29-.28-.64-.43-1.07-.43h-7c-.42,0-.78.14-1.07.43-.29.29-.43.65-.43,1.07s.14.78.43,1.07c.29.28.64.42,1.07.42h7Z" />
      </svg>
    ),
  },
  {
    href: '/vise',
    label: 'Više',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : '#c0c0c0'} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
]

type Mode = null | 'picker' | 'transakcija' | 'cek'

const PICKER_OPTIONS = [
  {
    key: 'transakcija' as const,
    label: 'Transakcija',
    desc: 'Prihod ili rashod',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    ),
  },
  {
    key: 'cek' as const,
    label: 'Ček',
    desc: 'Ček na naplatu · 5.000 RSD',
    icon: (
      <svg width="20" height="20" viewBox="0 0 39.66 38.67" fill="none"
        stroke="var(--text-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.56,23.31l-6.05.86.86-6.05L27.93,2.57c.34-.34.74-.61,1.19-.79.44-.18.92-.28,1.4-.28s.96.09,1.4.28c.44.18.85.45,1.19.79.34.34.61.74.79,1.19.18.44.28.92.28,1.4s-.09.96-.28,1.4c-.18.44-.45.85-.79,1.19l-15.55,15.55Z" />
        <path d="M8.83,15.17H3.94c-.65,0-1.27.26-1.73.72-.46.46-.72,1.08-.72,1.73v17.11c0,.65.26,1.27.72,1.73.46.46,1.08.72,1.73.72h31.77c.65,0,1.27-.26,1.73-.72s.72-1.08.72-1.73v-17.11c0-.65-.26-1.27-.72-1.73-.46-.46-1.08-.72-1.73-.72h-2.44" />
      </svg>
    ),
  },
]

function NavItem({ href, label, icon }: NavItemDef) {
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
      {icon(active)}
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
              {opt.icon}
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
        paddingBottom: 'calc(var(--safe-bottom) + 8px)',
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
