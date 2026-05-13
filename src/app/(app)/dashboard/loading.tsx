import { Skel } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skel dark w={80} h={12} />
              <Skel dark w={140} h={18} />
            </div>
            <Skel dark w={32} h={32} r={50} />
          </div>
          <Skel dark w={100} h={12} style={{ marginBottom: 8 }} />
          <Skel dark w={200} h={44} r={8} style={{ marginBottom: 20 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2, 3].map(i => <Skel key={i} dark w="33%" h={56} r={12} />)}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skel h={120} r={18} />
        <Skel h={80} r={18} />
        <Skel h={80} r={18} />
        <Skel h={80} r={18} />
      </div>
    </div>
  )
}
