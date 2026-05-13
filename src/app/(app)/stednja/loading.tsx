import { Skel, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Štednja</p>
          </div>
          <Skel dark w={60} h={12} style={{ marginBottom: 8 }} />
          <Skel dark w={180} h={44} r={8} />
        </div>
      </div>
      <LoadingRows count={3} height={80} />
    </div>
  )
}
