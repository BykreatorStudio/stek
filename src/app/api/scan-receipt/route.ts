import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function log(url: string, status: string, errorMsg: string | null, itemsFound: number) {
  try {
    await admin().from('qr_parse_logs').insert({ url, status, error_msg: errorMsg, items_found: itemsFound })
  } catch {}
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string' || !url.includes('suf.purs.gov.rs')) {
    return NextResponse.json({ error: 'Nevažeći URL' }, { status: 400 })
  }

  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sr,en-US;q=0.7,en;q=0.3',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      await log(url, 'fetch_error', `HTTP ${res.status}`, 0)
      return NextResponse.json({ error: `Greška pri učitavanju: HTTP ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } catch (err: any) {
    await log(url, 'fetch_error', err.message, 0)
    return NextResponse.json({ error: 'Nije moguće učitati račun' }, { status: 502 })
  }

  const $ = cheerio.load(html)

  // Extract merchant name — try common selectors
  const merchantName =
    $('[class*="buyer"] strong, [class*="merchant"] strong, [class*="company"] strong, h2, h3').first().text().trim() ||
    $('title').text().replace(/[-|].*$/, '').trim() ||
    ''

  // Extract total — look for the last numeric element near "Ukupno" or "Total"
  let totalAmount = 0
  $('td, th, span, div').each((_, el) => {
    const text = $(el).text().trim()
    if (/ukupno|total|svega/i.test(text)) {
      const next = $(el).next().text().trim()
      const val = parseAmount(next)
      if (val > totalAmount) totalAmount = val
    }
  })

  // Extract items — try all tables, pick the one that looks like an items table
  const items: { name: string; quantity: number; unit: string; unitPrice: number; total: number }[] = []

  $('table').each((_, table) => {
    const rows = $(table).find('tr')
    if (rows.length < 2) return

    // Check header row for receipt-like columns
    const headerText = rows.first().text().toLowerCase()
    const looksLikeReceipt =
      /naziv|artikal|opis|item|proizvod/.test(headerText) ||
      /kol|qty|kolicin/.test(headerText) ||
      /cena|price|iznos/.test(headerText)

    if (!looksLikeReceipt && items.length === 0) {
      // Try anyway if this is the only/first table with numeric data
    }

    rows.each((rowIdx, row) => {
      if (rowIdx === 0) return // skip header
      const cells = $(row).find('td')
      if (cells.length < 3) return

      const cellTexts = cells.toArray().map(c => $(c).text().trim())

      // Heuristic: first cell is name (text), last cells are numbers
      const name = cellTexts[0]
      if (!name || name.length < 2) return

      // Find numeric cells
      const nums = cellTexts.slice(1).map(t => parseAmount(t)).filter(n => n > 0)
      if (nums.length === 0) return

      const total = nums[nums.length - 1]
      const unitPrice = nums.length >= 2 ? nums[nums.length - 2] : total
      const quantity = nums.length >= 3 ? nums[0] : (unitPrice > 0 ? total / unitPrice : 1)

      // Try to find unit (JM column)
      let unit = 'KOM'
      cellTexts.slice(1).forEach(t => {
        if (/^(kom|kg|l|g|m|pak|kut|boc|lit)/i.test(t.trim())) unit = t.trim().toUpperCase()
      })

      items.push({
        name: name.replace(/\s+/g, ' '),
        quantity: Math.round(quantity * 100) / 100,
        unit,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(total * 100) / 100,
      })
    })

    if (items.length > 0) return false // break — found items
  })

  // If no table worked, try definition list or div-based layout
  if (items.length === 0) {
    $('[class*="item"], [class*="product"], [class*="article"]').each((_, el) => {
      const text = $(el).text().trim()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length >= 2) {
        const name = lines[0]
        const amount = parseAmount(lines[lines.length - 1])
        if (name && amount > 0) {
          items.push({ name, quantity: 1, unit: 'KOM', unitPrice: amount, total: amount })
        }
      }
    })
  }

  await log(url, items.length > 0 ? 'success' : 'parse_error',
    items.length === 0 ? 'No items extracted from HTML' : null, items.length)

  return NextResponse.json({ items, merchantName, totalAmount })
}
