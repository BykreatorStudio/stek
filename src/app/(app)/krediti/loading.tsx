import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Krediti" back />
      <LoadingRows count={4} height={72} />
    </div>
  )
}
