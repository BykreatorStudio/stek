import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Notifikacije" back />
      <LoadingRows count={6} height={60} />
    </div>
  )
}
