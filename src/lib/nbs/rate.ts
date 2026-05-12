import { createClient } from '@/lib/supabase/server'

const NBS_URL = 'https://www.nbs.rs/kursna_lista/en/middle.xml'

export async function fetchAndCacheNbsRate(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('nbs_rates')
    .select('eur_to_rsd')
    .eq('date', today)
    .single()

  if (cached) return cached.eur_to_rsd

  const rate = await fetchRateFromNbs()

  await supabase.from('nbs_rates').upsert({
    eur_to_rsd: rate,
    date: today,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'date' })

  return rate
}

async function fetchRateFromNbs(): Promise<number> {
  const res = await fetch(NBS_URL, { next: { revalidate: 3600 } })
  const xml = await res.text()

  const match = xml.match(/<item>\s*<Valuta>EUR<\/Valuta>[\s\S]*?<Srednji_kurs>([\d,]+)<\/Srednji_kurs>/)
  if (!match) throw new Error('EUR rate not found in NBS response')

  return parseFloat(match[1].replace(',', '.'))
}

export function convertToRsd(amount: number, eurToRsd: number): number {
  return Math.round(amount * eurToRsd)
}

export function convertToEur(amount: number, eurToRsd: number): number {
  return Math.round((amount / eurToRsd) * 100) / 100
}
