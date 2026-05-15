import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizovano' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API ključ nije podešen' }, { status: 500 })
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - dayOfMonth

  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const from = months[0] + '-01'
  const toLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const to = `${currentMonth}-${String(toLastDay).padStart(2, '0')}`

  const [
    { data: txsRaw },
    { data: catsRaw },
    { data: creditsRaw },
    { data: nbsRateRaw },
    { data: savingsRaw },
  ] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, currency, month, category_id, skip_accounting')
      .gte('date', from).lte('date', to),
    supabase.from('categories').select('id, name'),
    supabase.from('credits').select('name, monthly_payment, currency, remaining_amount').eq('status', 'aktivan'),
    supabase.from('nbs_rates').select('eur_to_rsd').order('date', { ascending: false }).limit(1).single(),
    supabase.from('savings').select('amount'),
  ])

  const eurToRsd: number = (nbsRateRaw as any)?.eur_to_rsd ?? 117
  const toRSD = (a: number, c: string) => c === 'EUR' ? a * eurToRsd : a

  const catMap = new Map((catsRaw ?? []).map((c: any) => [c.id, c.name]))
  const txs = txsRaw ?? []

  const historyTxs = txs.filter((t: any) => t.month !== currentMonth && !t.skip_accounting)
  const currentTxs = txs.filter((t: any) => t.month === currentMonth && !t.skip_accounting)

  const rashodi = currentTxs.filter((t: any) => t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
  const prihodi = currentTxs.filter((t: any) => t.type === 'prihod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)

  const prevMonths = months.slice(0, -1)
  const monthTotals = prevMonths.map(m =>
    historyTxs.filter((t: any) => t.month === m && t.type === 'rashod').reduce((s: number, t: any) => s + toRSD(t.amount, t.currency), 0)
  ).filter(v => v > 0)
  const avgMonthlyRashodi = monthTotals.length ? Math.round(monthTotals.reduce((s, v) => s + v, 0) / monthTotals.length) : 0
  const rashodiProjekcija = dayOfMonth > 0 ? Math.round((rashodi / dayOfMonth) * daysInMonth) : Math.round(rashodi)

  const last3 = months.slice(-4, -1)

  const catMonthMap: Record<string, Record<string, number>> = {}
  for (const t of historyTxs.filter((t: any) => t.type === 'rashod')) {
    const name = catMap.get(t.category_id)
    if (!name) continue
    if (!catMonthMap[name]) catMonthMap[name] = {}
    catMonthMap[name][t.month] = (catMonthMap[name][t.month] ?? 0) + toRSD(t.amount, t.currency)
  }

  const catCurrentMap: Record<string, number> = {}
  for (const t of currentTxs.filter((t: any) => t.type === 'rashod')) {
    const name = catMap.get(t.category_id)
    if (!name) continue
    catCurrentMap[name] = (catCurrentMap[name] ?? 0) + toRSD(t.amount, t.currency)
  }

  const cat3mAvg: Record<string, number> = {}
  for (const [name, monthData] of Object.entries(catMonthMap)) {
    const vals = last3.map(m => monthData[m] ?? 0)
    const nonZero = vals.filter(v => v > 0)
    if (nonZero.length >= 2) cat3mAvg[name] = vals.reduce((s, v) => s + v, 0) / 3
  }

  const kategorijePorednjeVsProsek = Object.entries(catCurrentMap)
    .map(([naziv, amount]) => {
      const avg = cat3mAvg[naziv] ?? 0
      if (avg < 500) return null
      const diff = amount - avg
      const diffPct = Math.round((diff / avg) * 100)
      return { naziv, ovajMesec: Math.round(amount), prosek3m: Math.round(avg), razlika: Math.round(diff), razlikaProcenat: diffPct }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Math.abs(b.razlikaProcenat) - Math.abs(a.razlikaProcenat))
    .slice(0, 6)

  const krediti = (creditsRaw ?? []).map((c: any) => {
    const mesecnaRata = Math.round(toRSD(c.monthly_payment, c.currency))
    const preostalosIznos = Math.round(toRSD(c.remaining_amount, c.currency))
    return {
      naziv: c.name,
      mesecnaRata,
      preostalosIznos,
      preostalosRata: mesecnaRata > 0 ? Math.round(preostalosIznos / mesecnaRata) : 0,
    }
  })

  const ukupnaStednja = Math.round((savingsRaw ?? []).reduce((s: number, r: any) => s + r.amount, 0))

  const context = {
    danas: now.toISOString().split('T')[0],
    danUMesecu: dayOfMonth,
    danaDoKrajaaMeseca: daysLeft,
    tekuciMesec: {
      prihodi: Math.round(prihodi),
      rashodi: Math.round(rashodi),
      ocekivaniRashodiDoKraja: rashodiProjekcija,
      prosekRashodaProteklihMeseci: avgMonthlyRashodi,
    },
    kategorijePoredjeneVsProsek: kategorijePorednjeVsProsek,
    krediti,
    ukupnaStednja,
  }

  const prompt = `Ti si finansijski savetnik za srpsko domacinstvo. Analiziras finansijske podatke i dajes konkretne, korisne savete.

Jezik: srpski, latinica. Pisati prirodno kao sto bi govorio pametan prijatelj koji se razume u finansije — bez stranih reci, bez birokratskog jezika. Primeri loseg pisanja: "projicirana potrosnja", "alokacija sredstava", "optimizacija". Primeri dobrog pisanja: "ocekivana potrosnja do kraja meseca", "slobodan novac", "rata kredita".

Na osnovu podataka ispod, generisi onoliko uvida koliko ima smisla — ni vise ni manje. Pravila:
- Koristiti tacne iznose u dinarima iz podataka (pisati "12.500 dinara" ne "12500 RSD")
- Konkretan savet — sta tacno uraditi, ne opstosti
- Ako nema podataka za odredjeni uvid, preskoci ga
- Ne izmisljaj podatke koji nisu u JSON-u

Vrati SAMO JSON niz, bez ikakvog teksta pre ili posle:
[
  {
    "tip": "upozorenje" | "savet" | "pozitivno",
    "naslov": "Kratki naslov, najvise 6 reci, bez zareza",
    "opis": "Konkretan opis sa tacknim brojevima i jasnom preporukom. Najvise 2-3 recenice. Bez uvoda tipa 'Primetili smo da'."
  }
]

Podaci:
${JSON.stringify(context, null, 2)}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as any).text ?? ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ error: 'Nevalidan odgovor od AI' }, { status: 500 })

    const insights = JSON.parse(match[0])
    return NextResponse.json({ insights, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Insights greška:', err)
    return NextResponse.json({ error: 'Greška pri generisanju analize' }, { status: 500 })
  }
}
