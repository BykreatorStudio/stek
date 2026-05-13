import { Skel, LoadingHeader } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="O aplikaciji" back />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skel h={160} r={16} />
        <Skel h={200} r={16} />
        <Skel h={240} r={16} />
        <Skel h={80} r={16} />
      </div>
    </div>
  )
}
