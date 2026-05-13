'use client'

import { useState, useRef, useEffect } from 'react'

export type SwipeAction = {
  label: string
  color?: 'danger' | 'neutral' | 'primary'
  onClick: () => void
}

const BTN_W = 76

export default function SwipeActions({
  children,
  actions,
  onTap,
  tapLabel = 'Otvori',
  style,
}: {
  children: React.ReactNode
  actions: SwipeAction[]
  onTap?: () => void
  tapLabel?: string
  style?: React.CSSProperties
}) {
  const [offset, setOffset] = useState(0)
  const [snap, setSnap] = useState(false)
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isTouch, setIsTouch] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef<'h' | 'v' | null>(null)
  const dragging = useRef(false)
  const openRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const reveal = actions.length * BTN_W

  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        doClose()
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  function doOpen() {
    openRef.current = true
    setOpen(true)
    setSnap(true)
    setOffset(reveal)
  }

  function doClose() {
    openRef.current = false
    setOpen(false)
    setSnap(true)
    setOffset(0)
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    locked.current = null
    dragging.current = true
    setSnap(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!locked.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      locked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (locked.current !== 'h') return
    const base = openRef.current ? reveal : 0
    setOffset(Math.max(0, Math.min(reveal, base - dx)))
  }

  function onTouchEnd(e: React.TouchEvent) {
    dragging.current = false
    setSnap(true)
    if (offset > reveal * 0.35) doOpen()
    else doClose()
    // Prevent the ghost click the browser synthesizes after a swipe gesture
    if (locked.current === 'h') e.preventDefault()
  }

  function handleCardClick() {
    if (isTouch) {
      if (openRef.current) {
        doClose()
      } else if (onTap) {
        onTap()
      } else if (hasActions) {
        doOpen()
      }
    } else {
      setShowModal(true)
    }
  }

  function btnBg(color?: string) {
    if (color === 'danger') return 'var(--red)'
    if (color === 'primary') return 'var(--accent-light)'
    return '#3f3f46'
  }

  function btnColor(color?: string) {
    if (color === 'primary') return 'var(--accent-dark)'
    return '#ffffff'
  }

  const hasActions = actions.length > 0
  const hasDesktopOptions = hasActions || !!onTap

  // Right corners collapse as card slides, so card + buttons form one unified shape
  const swiping = offset > 2
  const cardRadius = swiping ? '16px 0 0 16px' : '16px'
  const transition = snap ? 'transform 0.22s ease, border-radius 0.12s ease' : 'none'

  return (
    <>
      {/*
        No overflow:hidden here — card physically slides out with its shadow.
        overflow-x: hidden on body (globals.css) prevents horizontal scroll.
      */}
      <div
        style={{ position: 'relative', ...style }}
        ref={containerRef}
        onTouchStart={hasActions ? onTouchStart : undefined}
        onTouchMove={hasActions ? onTouchMove : undefined}
        onTouchEnd={hasActions ? onTouchEnd : undefined}
      >
        {/* Buttons sit behind the card, revealed as it slides left */}
        {hasActions && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: reveal, display: 'flex',
            borderRadius: '0 16px 16px 0', overflow: 'hidden',
          }}>
            {actions.map(a => (
              <button
                key={a.label}
                onClick={e => { e.stopPropagation(); doClose(); a.onClick() }}
                style={{
                  width: BTN_W, flexShrink: 0,
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                  lineHeight: 1.3, padding: '0 6px',
                  background: btnBg(a.color), color: btnColor(a.color),
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Card slides as one unit — shadow and border-radius move with it */}
        <div
          className="card"
          style={{
            position: 'relative', zIndex: 1,
            borderRadius: cardRadius,
            transform: `translateX(-${offset}px)`,
            transition,
            touchAction: 'pan-y',
            cursor: (onTap || (!isTouch && hasDesktopOptions)) ? 'pointer' : 'default',
            marginRight: '-1px',
          }}
          onClick={handleCardClick}
        >
          {children}
        </div>
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 540, background: 'var(--card)',
              borderRadius: '24px 24px 0 0', overflow: 'hidden',
              paddingBottom: 'calc(16px + var(--safe-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border-2)' }} />
            </div>
            {onTap && (
              <button
                onClick={() => { setShowModal(false); onTap() }}
                style={{
                  width: '100%', padding: '16px 24px', border: 'none',
                  borderBottom: hasActions ? '1px solid var(--border)' : 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 15, fontWeight: 500, color: 'var(--text-1)', textAlign: 'left',
                }}
              >
                {tapLabel}
              </button>
            )}
            {actions.map((a, i) => (
              <button
                key={a.label}
                onClick={() => { setShowModal(false); a.onClick() }}
                style={{
                  width: '100%', padding: '16px 24px', border: 'none',
                  borderBottom: i < actions.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 15, fontWeight: a.color === 'danger' ? 600 : 500,
                  color: a.color === 'danger' ? 'var(--red)' : 'var(--text-1)',
                  textAlign: 'left',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
