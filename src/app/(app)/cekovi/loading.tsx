import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Čekovi" back />
      <LoadingRows count={4} height={68} />
    </div>
  )
}
