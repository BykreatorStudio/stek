import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Članovi" back />
      <LoadingRows count={3} height={68} />
    </div>
  )
}
