'use client'

import { useState, useEffect, useRef } from 'react'

const DAY_LABELS = ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']

export default function CalendarPopup({
  value,
  onChange,
  onClose,
  inline,
}: {
  value: string
  onChange: (v: string) => void
  onClose: () => void
  inline?: boolean
}) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date()
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const selected = value ? new Date(value + 'T00:00:00') : null
  const now = new Date()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (inline) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const firstDay = (() => { const d = new Date(view.year, view.month, 1).getDay(); return d === 0 ? 6 : d - 1 })()
  const daysCount = new Date(view.year, view.month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysCount }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  const monthLabel = (() => {
    const s = new Date(view.year, view.month, 1).toLocaleString('sr-Latn-RS', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()

  function shift(delta: number) {
    setView(v => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function selectDay(day: number) {
    const m = String(view.month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${view.year}-${m}-${d}`)
    onClose()
  }

  return (
    <div ref={ref} style={inline ? { padding: '0 4px' } : {
      position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 400,
      background: 'var(--card)', borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
      padding: '16px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => shift(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{monthLabel}</span>
        <button onClick={() => shift(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', paddingBottom: 8 }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const isSel = selected?.getDate() === day && selected?.getMonth() === view.month && selected?.getFullYear() === view.year
          const isToday = now.getDate() === day && now.getMonth() === view.month && now.getFullYear() === view.year
          return (
            <button key={day} onClick={() => selectDay(day)} style={{
              aspectRatio: '1', borderRadius: '50%', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontFamily: 'inherit',
              border: isToday && !isSel ? '1.5px solid var(--border-2)' : 'none',
              background: isSel ? 'var(--text-1)' : 'transparent',
              color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-1)',
              fontWeight: isSel || isToday ? 500 : 400,
            }}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
