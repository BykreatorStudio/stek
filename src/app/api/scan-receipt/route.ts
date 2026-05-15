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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sr,en-US;q=0.7,en;q=0.3',
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string' || !url.includes('suf.purs.gov.rs')) {
    return NextResponse.json({ error: 'Nevažeći URL' }, { status: 400 })
  }

  // Step 1: Fetch the verification page to extract invoiceNumber + token
  let html = ''
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) {
      await log(url, 'fetch_error', `HTTP ${res.status}`, 0)
      return NextResponse.json({ error: `Greška pri učitavanju: HTTP ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } catch (err: any) {
    await log(url, 'fetch_error', err.message, 0)
    return NextResponse.json({ error: 'Nije moguće učitati račun' }, { status: 502 })
  }

  // Step 2: Extract invoiceNumber and token from embedded JS
  const invoiceMatch = html.match(/viewModel\.InvoiceNumber\('([^']+)'\)/)
  const tokenMatch = html.match(/viewModel\.Token\('([^']+)'\)/)

  if (!invoiceMatch || !tokenMatch) {
    await log(url, 'parse_error', 'invoiceNumber or token not found in HTML', 0)
    return NextResponse.json({ error: 'Nije moguće prepoznati račun' }, { status: 422 })
  }

  const invoiceNumber = invoiceMatch[1]
  const token = tokenMatch[1]

  // Step 3: Extract merchant info from HTML
  const $ = cheerio.load(html)
  const shopName = $('#shopFullNameLabel').text().trim()
  const city = $('#cityLabel').text().trim()
  const merchantName = [shopName, city].filter(Boolean).join(', ')

  // Step 4: Call the specifications API to get items
  let items: { name: string; quantity: number; unit: string; unitPrice: number; total: number }[] = []
  try {
    const specsRes = await fetch('https://suf.purs.gov.rs/specifications', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': url,
      },
      body: new URLSearchParams({ invoiceNumber, token }),
      signal: AbortSignal.timeout(10000),
    })

    if (specsRes.ok) {
      const data = await specsRes.json()
      if (data?.success && Array.isArray(data.items)) {
        items = data.items
          .filter((item: any) => item.name && item.total > 0)
          .map((item: any) => ({
            name: String(item.name).replace(/\s+/g, ' ').trim(),
            quantity: Math.round((Number(item.quantity) || 1) * 1000) / 1000,
            unit: 'KOM',
            unitPrice: Math.round((Number(item.unitPrice) || 0) * 100) / 100,
            total: Math.round((Number(item.total) || 0) * 100) / 100,
          }))
      }
    }
  } catch (err: any) {
    await log(url, 'specs_error', err.message, 0)
    return NextResponse.json({ error: 'Greška pri učitavanju stavki računa' }, { status: 502 })
  }

  const totalAmount = items.reduce((s, i) => s + i.total, 0)

  await log(url, items.length > 0 ? 'success' : 'parse_error',
    items.length === 0 ? 'Specifications API returned no items' : null, items.length)

  return NextResponse.json({ items, merchantName, totalAmount })
}
