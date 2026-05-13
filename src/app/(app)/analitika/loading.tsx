import { Skel, LoadingHeader } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Analitika" back />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Skel h={72} r={16} />
          <Skel h={72} r={16} />
          <Skel h={72} r={16} />
        </div>
        <Skel h={280} r={20} />
        <Skel h={220} r={20} />
        <Skel h={200} r={20} />
        <Skel h={200} r={20} />
      </div>
    </div>
  )
}
