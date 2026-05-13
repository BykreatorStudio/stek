import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Grupe" back />
      <LoadingRows count={4} height={60} />
    </div>
  )
}
