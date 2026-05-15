'use client'

import Link from 'next/link'
import { useState, useMemo, useCallback } from 'react'
import { notifyHousehold } from '@/lib/notify'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

type Insight = { tip: 'upozorenje' | 'savet' | 'pozitivno'; naslov: string; opis: string }

type MonthData = {
  month: string
  label: string
  prihodi: number
  rashodi: number
  bilans: number
  catBreakdown: Record<string, number>
  incomeCatBreakdown: Record<string, number>
  bucketBreakdown: Record<string, number>
  memberBreakdown: Record<string, { prihodi: number; rashodi: number }>
}

type Member = { id: string; name: string }

const PERIODS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
]

const COLORS = ['#C8FF31', '#5a9700', '#38bdf8', '#818cf8', '#f472b6', '#fb923c', '#a78bfa', '#34d399']
const RED_COLORS = ['#f87171', '#ef4444', '#fca5a5', '#dc2626', '#fecaca', '#b91c1c', '#fed7d7', '#991b1b']

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + 'k'
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(n))
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS').format(Math.round(Math.abs(n))) + ' RSD'
}

function CustomTooltip({ active, payload, label, labelMap }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)', minWidth: 140 }}>
      <p style={{ color: '#888', marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {labelMap?.[p.dataKey] ?? p.dataKey}: {fmtFull(p.value)}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: p.payload.fill, fontWeight: 600, marginBottom: 2 }}>{p.name}</p>
      <p style={{ color: '#fff' }}>{fmtFull(p.value)}</p>
    </div>
  )
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--card)', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)', minWidth: 0 }}>
      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>{label}</p>
      <p className="num" style={{ fontSize: 17, fontWeight: 600, color: color ?? 'var(--text-1)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children, noPad }: { title: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, padding: noPad ? '20px 0 0' : '20px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)', userSelect: 'none' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 20, paddingLeft: noPad ? 16 : 4 }}>{title}</p>
      {children}
    </div>
  )
}

function ColorDot({ color }: { color: string }) {
  return <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: color }} />
}

function EmptyChart() {
  return (
    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nema dovoljno podataka</p>
    </div>
  )
}

const INSIGHT_STYLE: Record<string, { bg: string; color: string }> = {
  upozorenje: { bg: 'var(--red-light)', color: 'var(--red)' },
  savet:      { bg: 'var(--bg-subtle)', color: 'var(--text-2)' },
  pozitivno:  { bg: 'var(--accent-light)', color: 'var(--accent-dark)' },
}

function InsightIcon({ tip }: { tip: string }) {
  const color = INSIGHT_STYLE[tip]?.color ?? 'var(--text-2)'
  if (tip === 'upozorenje') return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  if (tip === 'pozitivno') return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  )
}

function fmtGenerated(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long' }) +
    ' u ' + d.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })
}

export default function AnalitikaClient({
  monthlyData,
  savingsHistory,
  totalSavings,
  members,
  householdId,
}: {
  monthlyData: MonthData[]
  savingsHistory: { label: string; value: number }[]
  totalSavings: number
  members: Member[]
  householdId: string | null
}) {
  const [period, setPeriod] = useState(6)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true)
    setInsightsError('')
    try {
      const res = await fetch('/api/generate-insights', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setInsightsError(json.error ?? 'Greška'); return }
      setInsights(json.insights)
      setGeneratedAt(json.generatedAt)
      const upozorenja = json.insights.filter((i: Insight) => i.tip === 'upozorenje').length
      const body = upozorenja > 0
        ? `${json.insights.length} uvida · ${upozorenja} upozorenje`
        : `${json.insights.length} uvida`
      notifyHousehold({ householdId, type: 'ai_uvidi', title: 'AI analiza završena', body, data: { insights: json.insights } })
    } catch {
      setInsightsError('Nije moguće učitati analizu')
    } finally {
      setInsightsLoading(false)
    }
  }, [householdId])

  const slice = useMemo(() => monthlyData.slice(-period), [monthlyData, period])

  const { avgPrihodi, avgRashodi } = useMemo(() => {
    const withIncome = slice.filter(m => m.prihodi > 0)
    const withExpense = slice.filter(m => m.rashodi > 0)
    return {
      avgPrihodi: withIncome.length ? withIncome.reduce((s, m) => s + m.prihodi, 0) / withIncome.length : 0,
      avgRashodi: withExpense.length ? withExpense.reduce((s, m) => s + m.rashodi, 0) / withExpense.length : 0,
    }
  }, [slice])

  const avgBilans = avgPrihodi - avgRashodi
  const hasData = slice.some(m => m.prihodi > 0 || m.rashodi > 0)
  const hasRashodi = slice.some(m => m.rashodi > 0)
  const hasPrihodi = slice.some(m => m.prihodi > 0)

  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {}
    slice.forEach(m => {
      Object.entries(m.catBreakdown).forEach(([name, val]) => {
        totals[name] = (totals[name] ?? 0) + val
      })
    })
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [slice])

  const incomeCategoryData = useMemo(() => {
    const totals: Record<string, number> = {}
    slice.forEach(m => {
      Object.entries(m.incomeCatBreakdown ?? {}).forEach(([name, val]) => {
        totals[name] = (totals[name] ?? 0) + val
      })
    })
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [slice])

  const bucketData = useMemo(() => {
    const totals: Record<string, number> = {}
    slice.forEach(m => {
      Object.entries(m.bucketBreakdown).forEach(([name, val]) => {
        totals[name] = (totals[name] ?? 0) + val
      })
    })
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [slice])

  const memberData = useMemo(() => {
    return members.map(m => {
      let prihodi = 0, rashodi = 0
      slice.forEach(month => {
        const mb = month.memberBreakdown[m.id]
        if (mb) { prihodi += mb.prihodi; rashodi += mb.rashodi }
      })
      return { ...m, prihodi, rashodi }
    }).filter(m => m.prihodi > 0 || m.rashodi > 0)
  }, [members, slice])

  const hasSavings = savingsHistory.length > 1

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
            <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 3 }}>
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                  padding: '5px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: period === p.value ? '#fff' : 'transparent',
                  color: period === p.value ? '#111' : 'var(--header-muted)',
                  transition: 'all 0.15s',
                }}>
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
          <StatCard label="RASH. / MES." value={avgRashodi > 0 ? fmt(avgRashodi) : '—'} color="var(--red)" sub={avgRashodi > 0 ? 'RSD prosek' : undefined} />
          <StatCard label="PRIH. / MES." value={avgPrihodi > 0 ? fmt(avgPrihodi) : '—'} color="var(--accent-dark)" sub={avgPrihodi > 0 ? 'RSD prosek' : undefined} />
          <StatCard
            label="BILANS / MES."
            value={avgBilans !== 0 ? (avgBilans > 0 ? '+' : '') + fmt(avgBilans) : '—'}
            color={avgBilans > 0 ? 'var(--accent-dark)' : avgBilans < 0 ? 'var(--red)' : undefined}
            sub={avgBilans !== 0 ? 'RSD prosek' : undefined}
          />
        </div>

        {/* Rashodi po mesecu */}
        {hasRashodi && (
          <ChartCard title="Rashodi po mesecu">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={slice} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<CustomTooltip labelMap={{ rashodi: 'Rashodi' }} />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                <Bar dataKey="rashodi" fill="#f87171" radius={[5, 5, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Rashodi po kategoriji */}
        {categoryData.length > 0 && (
          <ChartCard title="Rashodi po kategoriji" noPad>
            <div style={{ display: 'flex', gap: 0, padding: '0 16px 16px' }}>
              <div style={{ flexShrink: 0, marginRight: 8 }}>
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={0}>
                      {categoryData.map((_, i) => <Cell key={i} fill={RED_COLORS[i % RED_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                {categoryData.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ColorDot color={RED_COLORS[i % RED_COLORS.length]} />
                    <p style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p className="num" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{c.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {categoryData.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < categoryData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ width: 18, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</p>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flexShrink: 0, marginLeft: 8 }}>{fmt(c.value)}</p>
                    </div>
                    <div style={{ height: 3, borderRadius: 3, background: 'var(--border-2)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: RED_COLORS[i % RED_COLORS.length], width: `${c.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Rashodi po grupi */}
        {bucketData.length > 1 && (
          <ChartCard title="Rashodi po grupi" noPad>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {bucketData.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < bucketData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: RED_COLORS[i % RED_COLORS.length] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{b.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <p className="num" style={{ fontSize: 13, color: 'var(--text-3)' }}>{b.pct}%</p>
                        <p className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{fmt(b.value)}</p>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: RED_COLORS[i % RED_COLORS.length], width: `${b.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Prihodi po mesecu */}
        {hasPrihodi && (
          <ChartCard title="Prihodi po mesecu">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={slice} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<CustomTooltip labelMap={{ prihodi: 'Prihodi' }} />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                <Bar dataKey="prihodi" fill="#C8FF31" radius={[5, 5, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Prihodi po kategoriji */}
        {incomeCategoryData.length > 1 && (
          <ChartCard title="Prihodi po kategoriji" noPad>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {incomeCategoryData.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < incomeCategoryData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ width: 18, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</p>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flexShrink: 0, marginLeft: 8 }}>{fmt(c.value)}</p>
                    </div>
                    <div style={{ height: 3, borderRadius: 3, background: 'var(--border-2)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: COLORS[i % COLORS.length], width: `${c.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Bilans trend */}
        {hasData && (
          <ChartCard title="Trend bilansa">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={slice}>
                <defs>
                  <linearGradient id="bilansPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8FF31" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#C8FF31" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<CustomTooltip labelMap={{ bilans: 'Bilans' }} />} />
                <Area type="monotone" dataKey="bilans" stroke="#C8FF31" strokeWidth={2.5} fill="url(#bilansPos)"
                  dot={{ fill: '#C8FF31', strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: '#C8FF31', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Po članovima */}
        {memberData.length > 0 && (
          <ChartCard title="Po članovima" noPad>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {memberData.map((m, i) => {
                const total = m.prihodi + m.rashodi
                return (
                  <div key={m.id} style={{ padding: '14px 16px', borderBottom: i < memberData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 10 }}>{m.name}</p>
                    {m.prihodi > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Prihodi</p>
                        <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: '#C8FF31', width: `${total > 0 ? Math.round((m.prihodi / total) * 100) : 0}%` }} />
                        </div>
                        <p className="num" style={{ fontSize: 12, color: 'var(--accent-dark)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>+{fmt(m.prihodi)}</p>
                      </div>
                    )}
                    {m.rashodi > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Rashodi</p>
                        <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--border-2)' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: '#f87171', width: `${total > 0 ? Math.round((m.rashodi / total) * 100) : 0}%` }} />
                        </div>
                        <p className="num" style={{ fontSize: 12, color: 'var(--red)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>-{fmt(m.rashodi)}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ChartCard>
        )}

        {/* Štednja */}
        {hasSavings && (
          <ChartCard title="Rast štednje">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={savingsHistory}>
                <defs>
                  <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8FF31" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#C8FF31" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<CustomTooltip labelMap={{ value: 'Štednja' }} />} />
                <Area type="monotone" dataKey="value" stroke="#C8FF31" strokeWidth={2.5} fill="url(#savGrad)" dot={false} activeDot={{ r: 4, fill: '#C8FF31', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--accent-dark)', fontWeight: 500 }}>Ukupna štednja</p>
              <p className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-dark)' }}>{fmtFull(totalSavings)}</p>
            </div>
          </ChartCard>
        )}

        {/* AI uvidi */}
        <div style={{ background: 'var(--card)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>AI uvidi</p>
            {insights.length > 0 && !insightsLoading && (
              <button onClick={fetchInsights} style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Osveži analizu
              </button>
            )}
          </div>

          {insightsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 20px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.15"/>
                <path d="M21 12a9 9 0 00-9-9"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Analiziram podatke...</p>
            </div>
          )}

          {!insightsLoading && insightsError && (
            <div style={{ padding: '0 16px 18px' }}>
              <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>{insightsError}</p>
              <button onClick={fetchInsights} style={{ fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                Pokušaj ponovo
              </button>
            </div>
          )}

          {!insightsLoading && insights.length === 0 && !insightsError && (
            <div style={{ padding: '0 16px 18px', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '16px 0 14px' }}>
                Analiziraj potrošnju i kredite za konkretne preporuke.
              </p>
              <button onClick={fetchInsights} className="btn-primary">
                Analiziraj
              </button>
            </div>
          )}

          {!insightsLoading && insights.length > 0 && (
            <>
              {insights.map((ins, i) => {
                const s = INSIGHT_STYLE[ins.tip] ?? INSIGHT_STYLE.savet
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <InsightIcon tip={ins.tip} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{ins.naslov}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{ins.opis}</p>
                    </div>
                  </div>
                )
              })}
              {generatedAt && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  Generisano {fmtGenerated(generatedAt)}
                </p>
              )}
            </>
          )}
        </div>

        {!hasData && (
          <div style={{ background: 'var(--card)', borderRadius: 20, padding: '40px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Nema podataka za prikaz</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Dodaj transakcije da bi video analitiku</p>
          </div>
        )}

      </div>
    </div>
  )
}
