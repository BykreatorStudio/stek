import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CekoviClient from './CekoviClient'
import type { Cek } from '@/types'

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(n)
}

export default async function CekoviPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('cekovi')
    .select('*')
    .order('date', { ascending: true })

  const checks = (data ?? []) as Cek[]
  const pending = checks.filter(c => c.status === 'na_cekanju')
  const totalQty = pending.reduce((s, c) => s + c.quantity, 0)
  const totalAmount = totalQty * CEK_VALUE

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 6 }}>Na čekanju</p>
          <p className="num" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1, marginBottom: 8, color: 'var(--header-text)' }}>
            {pending.length > 0 ? fmt(totalAmount) : '—'}
            {pending.length > 0 && <span style={{ fontSize: 20, color: 'var(--header-muted)', fontWeight: 400, marginLeft: 8 }}>RSD</span>}
          </p>
          <p style={{ fontSize: 13, color: 'var(--header-muted)' }}>
            {pending.length > 0
              ? `${totalQty} ${totalQty === 1 ? 'ček' : totalQty < 5 ? 'čeka' : 'čekova'} · ${pending.length} ${pending.length === 1 ? 'stavka' : 'stavki'}`
              : 'Nema čekova na čekanju'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <CekoviClient checks={checks} />
      </div>
    </div>
  )
}
