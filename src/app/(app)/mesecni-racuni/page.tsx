import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MesecniRacuniClient from './MesecniRacuniClient'

export default async function MesecniRacuniPage() {
  const supabase = await createClient()

  const [{ data: bucketsRaw }, { data: categories }, { data: items }] = await Promise.all([
    supabase.from('buckets').select('*').order('sort_order'),
    supabase.from('categories').select('*').eq('type', 'rashod').eq('is_active', true).order('name'),
    supabase.from('recurring_items').select('*, bucket:buckets(name), category:categories(name)').eq('is_active', true).order('due_day'),
  ])

  const buckets = bucketsRaw ?? []

  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Mesečni računi</p>
        </div>
      </div>

      <MesecniRacuniClient
        buckets={buckets}
        categories={categories ?? []}
        items={items ?? []}
      />
    </div>
  )
}
