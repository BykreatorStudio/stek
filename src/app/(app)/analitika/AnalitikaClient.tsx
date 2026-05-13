'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

type MonthData = { month: string; label: string; prihodi: number; rashodi: number; bilans: number }
type CatData = { name: string; value: number }
type SavData = { label: string; value: number }

const PERIODS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
]

const CAT_COLORS = [
  '#C8FF31', '#5a9700', '#38bdf8', '#818cf8', '#f472b6',
  '#fb923c', '#a78bfa', '#34d399',
]

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k'
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n))) + ' RSD'
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--card)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)', minWidth: 0 }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 500, letterSpacing: '0.03em' }}>{label}</p>
      <p className="num" style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text-1)', lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, padding: '20px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 20, paddingLeft: 4 }}>{title}</p>
      {children}
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: '#aaa', marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name === 'prihodi' ? 'Prihodi' : 'Rashodi'}: {fmtFull(p.value)}
        </p>
      ))}
    </div>
  )
}

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: '#aaa', marginBottom: 4 }}>{label}</p>
      <p style={{ color: val >= 0 ? '#C8FF31' : '#f87171', fontWeight: 600 }}>
        {val >= 0 ? '+' : ''}{fmtFull(val)}
      </p>
    </div>
  )
}

function SavingsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: '#aaa', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#C8FF31', fontWeight: 600 }}>{fmtFull(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: p.payload.fill, fontWeight: 600, marginBottom: 2 }}>{p.name}</p>
      <p style={{ color: '#fff' }}>{fmtFull(p.value)}</p>
    </div>
  )
}

export default function AnalitikaClient({
  monthlyData,
  categoryData,
  savingsHistory,
  totalSavings,
}: {
  monthlyData: MonthData[]
  categoryData: CatData[]
  savingsHistory: SavData[]
  totalSavings: number
}) {
  const [period, setPeriod] = useState(6)

  const slice = useMemo(() => monthlyData.slice(-period), [monthlyData, period])

  const avgPrihodi = useMemo(() => {
    const withData = slice.filter(m => m.prihodi > 0)
    if (!withData.length) return 0
    return withData.reduce((s, m) => s + m.prihodi, 0) / withData.length
  }, [slice])

  const avgRashodi = useMemo(() => {
    const withData = slice.filter(m => m.rashodi > 0)
    if (!withData.length) return 0
    return withData.reduce((s, m) => s + m.rashodi, 0) / withData.length
  }, [slice])

  const avgBilans = avgPrihodi - avgRashodi
  const hasBarData = slice.some(m => m.prihodi > 0 || m.rashodi > 0)
  const hasBilans = slice.some(m => m.prihodi > 0 || m.rashodi > 0)
  const hasSavings = savingsHistory.length > 0

  const totalRashodi = useMemo(() => slice.reduce((s, m) => s + m.rashodi, 0), [slice])
  const catWithPct = categoryData.map(c => ({
    ...c,
    pct: totalRashodi > 0 ? Math.round((c.value / totalRashodi) * 100) : 0,
  }))

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', textDecoration: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>Analitika</p>
            </div>
            {/* Period tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 3 }}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: period === p.value ? '#fff' : 'transparent',
                    color: period === p.value ? '#111' : 'var(--header-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          <StatCard
            label="PRIH. / MES."
            value={avgPrihodi > 0 ? fmt(avgPrihodi) : '—'}
            color="var(--accent)"
            sub={avgPrihodi > 0 ? 'RSD prosek' : undefined}
          />
          <StatCard
            label="RASH. / MES."
            value={avgRashodi > 0 ? fmt(avgRashodi) : '—'}
            color="var(--red)"
            sub={avgRashodi > 0 ? 'RSD prosek' : undefined}
          />
          <StatCard
            label="BILANS / MES."
            value={avgBilans !== 0 ? (avgBilans > 0 ? '+' : '') + fmt(avgBilans) : '—'}
            color={avgBilans > 0 ? 'var(--accent)' : avgBilans < 0 ? 'var(--red)' : undefined}
            sub={avgBilans !== 0 ? 'RSD prosek' : undefined}
          />
        </div>

        {/* Prihodi vs Rashodi bar chart */}
        <ChartCard title="Prihodi & Rashodi">
          {hasBarData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={slice} barGap={3} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                <Bar dataKey="prihodi" fill="#C8FF31" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="rashodi" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <Legend color="#C8FF31" label="Prihodi" />
            <Legend color="#f87171" label="Rashodi" />
          </div>
        </ChartCard>

        {/* Bilans trend area chart */}
        <ChartCard title="Trend bilansa">
          {hasBilans ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={slice}>
                <defs>
                  <linearGradient id="bilansGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8FF31" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C8FF31" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bilansGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<AreaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="bilans"
                  stroke="#C8FF31"
                  strokeWidth={2.5}
                  fill="url(#bilansGrad)"
                  dot={{ fill: '#C8FF31', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: '#C8FF31', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* Category breakdown */}
        {catWithPct.length > 0 && (
          <ChartCard title="Rashodi po kategoriji">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={catWithPct} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0}>
                      {catWithPct.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {catWithPct.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <p style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p className="num" style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{c.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}

        {/* Savings growth */}
        {hasSavings && (
          <ChartCard title="Rast štednje">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={savingsHistory}>
                <defs>
                  <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8FF31" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C8FF31" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<SavingsTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#C8FF31" strokeWidth={2.5} fill="url(#savGrad)" dot={false} activeDot={{ r: 4, fill: '#C8FF31', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--accent-dark)', fontWeight: 500 }}>Ukupna štednja</p>
              <p className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-dark)' }}>{fmtFull(totalSavings)}</p>
            </div>
          </ChartCard>
        )}

      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nema dovoljno podataka</p>
    </div>
  )
}
