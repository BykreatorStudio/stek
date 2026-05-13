import { Skel } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Skel dark w={36} h={36} r={50} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Skel dark w={100} h={12} />
              <Skel dark w={80} h={20} />
            </div>
            <Skel dark w={36} h={36} r={50} />
          </div>
          <Skel dark w={140} h={12} style={{ marginBottom: 8 }} />
          <Skel dark w={220} h={44} r={8} style={{ marginBottom: 20 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Skel dark w="50%" h={64} r={12} />
            <Skel dark w="50%" h={64} r={12} />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map(i => <Skel key={i} h={60} r={16} />)}
      </div>
    </div>
  )
}
