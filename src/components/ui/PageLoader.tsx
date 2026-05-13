export function Skel({ w = '100%', h = 16, r = 10, dark = false, style }: { w?: string | number; h?: number; r?: number; dark?: boolean; style?: React.CSSProperties }) {
  return <div className={dark ? 'skeleton-dark' : 'skeleton'} style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function BackChevron() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </div>
  )
}

export function LoadingHeader({ title, back = false, children }: { title: string; back?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...(children ? { marginBottom: 24 } : {}) }}>
          {back && <BackChevron />}
          <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>{title}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoadingRows({ count = 5, height = 64, gap = 10, padding = '20px 16px' }: { count?: number; height?: number; gap?: number; padding?: string }) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding, display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 16 }} />
      ))}
    </div>
  )
}
