import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TransakcijeSection from './TransakcijeSection'
import NotifBell from '@/components/layout/NotifBell'

const CEK_VALUE = 5000

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n)))
}


function daysUntilLabel(dueDate: Date, today: Date): string {
  const diff = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Danas'
  if (diff === 1) return 'Sutra'
  return `Za ${diff} dana`
}

function getEffectiveDueDate(dueDay: number, today: Date): Date {
  const y = today.getFullYear()
  const m = today.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  const thisMonth = new Date(y, m, Math.min(dueDay, lastDay))
  if (thisMonth >= today) return thisMonth
  const nextLastDay = new Date(y, m + 2, 0).getDate()
  return new Date(y, m + 1, Math.min(dueDay, nextLastDay))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('sr-Latn-RS', { month: 'long', year: 'numeric' })
  const monthStart = `${month}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`

  const [
    { data: profileRaw },
    { data: txs },
    { data: recurringRaw },
    { data: checksRaw },
    { data: creditsRaw },
    { data: creditPaysRaw },
    { data: debtsRaw },
    { data: debtPaysRaw },
    { data: savingsRaw },
    { data: membersRaw },
    { data: nbsRateRaw },
    { data: recentTxsRaw },
  ] = await Promise.all([
    supabase.from('members').select('name').eq('user_id', user.id).single(),
    supabase.from('transactions').select('*').eq('month', month),
    supabase.from('recurring_items').select('*').eq('is_active', true),
    supabase.from('checks').select('*').eq('status', 'na_cekanju'),
    supabase.from('credits').select('*').eq('status', 'aktivan'),
    supabase.from('credit_payments').select('credit_id').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('debts').select('*').eq('status', 'aktivno'),
    supabase.from('debt_payments').select('debt_id, amount'),
    supabase.from('savings').select('amount'),
    supabase.from('members').select('*').order('sort_order'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('transactions').select('id, type, name, amount, currency, date').order('date', { ascending: false }).limit(10),
  ])

  const profile = profileRaw
  const transactions = txs ?? []
  const recurring = recurringRaw ?? []
  const checks = checksRaw ?? []
  const credits = creditsRaw ?? []
  const creditPays = creditPaysRaw ?? []
  const debts = debtsRaw ?? []
  const debtPays = debtPaysRaw ?? []
  const members = membersRaw ?? []
  const recentTxs = recentTxsRaw ?? []
  const eurToRsd: number = (nbsRateRaw as any)?.eur_to_rsd ?? 117

  // --- Month cash flow ---
  const totalPrihodi = transactions.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + t.amount, 0)
  const totalRashodi = transactions.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + t.amount, 0)
  const balance = totalPrihodi - totalRashodi
  const hasData = transactions.length > 0

  // --- Monthly obligations ---
  const paidRecurringIds = new Set(transactions.filter((t: any) => t.recurring_item_id).map((t: any) => t.recurring_item_id))
  const paidCreditIds = new Set(creditPays.map((p: any) => p.credit_id))
  const paidRecurringCount = recurring.filter((r: any) => paidRecurringIds.has(r.id)).length
  const paidCreditCount = credits.filter((c: any) => paidCreditIds.has(c.id)).length
  const paidCount = paidRecurringCount + paidCreditCount
  const totalObligations = recurring.length + credits.length
  const allPaid = totalObligations > 0 && paidCount === totalObligations

  // Pending checks
  const pendingChecksQty = checks.reduce((s: number, c: any) => s + c.quantity, 0)
  const pendingChecksAmount = pendingChecksQty * CEK_VALUE

  // Fixed monthly total
  const fixedTotal = recurring.filter((r: any) => r.type === 'fiksni').reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
  const creditTotal = credits.reduce((s: number, c: any) => s + c.monthly_payment, 0)

  // --- Financial picture ---
  const safBalance = (savingsRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0)

  const debtsWithPaid = debts.map((d: any) => {
    const paid = debtPays.filter((p: any) => p.debt_id === d.id).reduce((s: number, p: any) => s + p.amount, 0)
    return { ...d, remaining: d.total_amount - paid }
  })
  const totalDugujemo = debtsWithPaid.filter((d: any) => d.direction === 'dugujemo').reduce((s: number, d: any) => s + d.remaining, 0)
  const totalDugujuNam = debtsWithPaid.filter((d: any) => d.direction === 'duguju_nam').reduce((s: number, d: any) => s + d.remaining, 0)
  const totalKrediti = credits.reduce((s: number, c: any) => s + c.remaining_amount, 0)

  // --- By member ---
  const memberStats = members.map((m: any) => {
    const mTxs = transactions.filter((t: any) => t.member_id === m.id)
    const prihodi = mTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + t.amount, 0)
    const rashodi = mTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + t.amount, 0)
    return { id: m.id, name: m.name, avatar_url: m.avatar_url ?? null, prihodi, rashodi, count: mTxs.length }
  })

  // --- Upcoming in next 15 days ---
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in15 = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)

  type UpcomingItem = { name: string; amount: number; currency: string; dueDate: Date; label: string }
  const upcomingItems: UpcomingItem[] = []

  for (const r of recurring) {
    if (paidRecurringIds.has(r.id)) continue
    const dueDate = getEffectiveDueDate(r.due_day, today)
    if (dueDate >= today && dueDate <= in15) {
      upcomingItems.push({ name: r.name, amount: r.amount ?? 0, currency: r.currency, dueDate, label: daysUntilLabel(dueDate, today) })
    }
  }
  for (const c of credits) {
    if (paidCreditIds.has(c.id)) continue
    const dueDate = getEffectiveDueDate(c.due_day, today)
    if (dueDate >= today && dueDate <= in15) {
      upcomingItems.push({ name: c.name, amount: c.monthly_payment, currency: c.currency, dueDate, label: daysUntilLabel(dueDate, today) })
    }
  }
  upcomingItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 3 }}>{cap(monthLabel)}</p>
              <p style={{ fontSize: 18, color: 'var(--header-text)', fontWeight: 500 }}>Zdravo, {profile?.name}</p>
            </div>
            <NotifBell />
          </div>

          {/* Hero balance */}
          <p style={{ fontSize: 12, color: 'var(--header-muted)', marginBottom: 6 }}>Bilans meseca</p>
          <p className="num" style={{
            fontSize: 44, fontWeight: 500, lineHeight: 1, marginBottom: 20,
            color: !hasData ? 'var(--header-text)' : balance >= 0 ? 'var(--accent-on-dark)' : '#f87171',
          }}>
            {!hasData ? '—' : (balance >= 0 ? '+' : '-') + fmt(balance)}
            {hasData && <span style={{ fontSize: 20, color: 'var(--header-muted)', fontWeight: 400, marginLeft: 8 }}>RSD</span>}
          </p>

          {/* Prihodi / Rashodi / Obaveze */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Prihodi</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: hasData ? 'var(--accent-on-dark)' : 'var(--header-muted)' }}>
                {hasData ? fmt(totalPrihodi) : '—'}
                {hasData && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Rashodi</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: hasData ? '#f87171' : 'var(--header-muted)' }}>
                {hasData ? fmt(totalRashodi) : '—'}
                {hasData && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, opacity: 0.6 }}>RSD</span>}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'var(--header-muted)', marginBottom: 4 }}>Obaveze</p>
              <p className="num" style={{ fontSize: 16, fontWeight: 500, color: allPaid ? 'var(--accent-on-dark)' : 'var(--header-text)' }}>
                {paidCount}/{totalObligations}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        {/* --- Ovaj mesec --- */}
        {(totalObligations > 0 || pendingChecksAmount > 0) && (
          <>
            <p className="section-label">Ovaj mesec</p>
            <Link href="/troskovi" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '16px 20px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Mesečne obaveze</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {paidCount} od {totalObligations} plaćeno
                      {fixedTotal + creditTotal > 0 ? ` · ${fmt(fixedTotal + creditTotal)} RSD` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                      background: allPaid ? 'var(--accent-light)' : 'rgba(248,113,113,0.12)',
                      color: allPaid ? 'var(--accent-dark)' : 'var(--red)',
                    }}>
                      {allPaid ? 'Sve plaćeno' : `${totalObligations - paidCount} preostalo`}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: 'var(--accent)',
                    width: totalObligations > 0 ? `${(paidCount / totalObligations) * 100}%` : '0%',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            </Link>

            {pendingChecksAmount > 0 && (
              <Link href="/cekovi" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '16px 20px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Čekovi na naplati</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {pendingChecksQty} {pendingChecksQty === 1 ? 'ček' : pendingChecksQty < 5 ? 'čeka' : 'čekova'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)' }}>{fmt(pendingChecksAmount)} RSD</p>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </>
        )}

        {/* --- Finansijska slika --- */}
        <p className="section-label">Finansijska slika</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>

          <Link href="/stednja" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14v-4m0 0V8m0 4H8m4 0h4" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Sef</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Gotovinska štednja</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p className="num" style={{ fontSize: 15, fontWeight: 500, color: safBalance > 0 ? 'var(--accent)' : safBalance < 0 ? 'var(--red)' : 'var(--text-3)' }}>
                  {savingsRaw && savingsRaw.length > 0 ? `${fmt(safBalance)} RSD` : '—'}
                </p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </Link>

          {(totalDugujemo > 0 || totalDugujuNam > 0) && (
            <Link href="/dugovi" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Dugovi</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {totalDugujemo > 0 && `Mi dugujemo ${fmt(totalDugujemo)} RSD`}
                      {totalDugujemo > 0 && totalDugujuNam > 0 && ' · '}
                      {totalDugujuNam > 0 && `Duguju nam ${fmt(totalDugujuNam)} RSD`}
                    </p>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          )}

          {totalKrediti > 0 && (
            <Link href="/krediti" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>Krediti</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {credits.length} aktivan{credits.length !== 1 ? (credits.length < 5 ? 'a' : 'ih') : ''} · rata {fmt(creditTotal)} RSD/mes
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p className="num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--red)' }}>{fmt(totalKrediti)} RSD</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* --- Po članovima --- */}
        {members.length > 0 && hasData && (
          <>
            <p className="section-label">Po članovima</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {memberStats.map((m: any) => (
                <div key={m.id} className="card" style={{ flex: 1, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{m.name.charAt(0)}</span>
                      </div>
                    )}
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{m.name}</p>
                  </div>
                  {m.count > 0 ? (
                    <>
                      {m.rashodi > 0 && (
                        <p className="num" style={{ fontSize: 13, color: 'var(--red)', marginBottom: 2 }}>-{fmt(m.rashodi)} RSD</p>
                      )}
                      {m.prihodi > 0 && (
                        <p className="num" style={{ fontSize: 13, color: 'var(--accent)' }}>+{fmt(m.prihodi)} RSD</p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>—</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* --- Poslednje transakcije --- */}
        <TransakcijeSection recentTxs={recentTxs} />

        {/* --- Uskoro za naplatu --- */}
        {upcomingItems.length > 0 && (
          <>
            <p className="section-label">Uskoro za naplatu</p>
            <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
              {upcomingItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 20px',
                  borderBottom: i < upcomingItems.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p className="num" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{fmt(item.amount)} {item.currency}</p>
                  </div>
                  <span style={{
                    flexShrink: 0, marginLeft: 12,
                    fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                    background: item.label === 'Danas' || item.label === 'Sutra' ? 'rgba(248,113,113,0.12)' : 'var(--bg-subtle)',
                    color: item.label === 'Danas' || item.label === 'Sutra' ? 'var(--red)' : 'var(--text-2)',
                  }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!hasData && recentTxs.length === 0 && (
          <div className="card" style={{ padding: '24px 20px', textAlign: 'center', marginTop: 8 }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>
              Pritisni <span style={{ fontWeight: 500 }}>+</span> da dodaš prvu transakciju
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
