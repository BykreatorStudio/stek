import { LoadingHeader, LoadingRows } from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div>
      <LoadingHeader title="Kategorije" back />
      <LoadingRows count={5} height={60} />
    </div>
  )
}
