import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Podešavanja" back />
      <LoadingRows count={4} height={56} />
    </div>
  )
}
