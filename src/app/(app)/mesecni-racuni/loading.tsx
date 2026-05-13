import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Mesečni računi" back />
      <LoadingRows count={5} height={64} />
    </div>
  )
}
