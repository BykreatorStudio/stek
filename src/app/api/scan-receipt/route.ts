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

const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sr-RS,sr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

function extractCookies(res: Response): string {
  try {
    const all: string[] = (res.headers as any).getSetCookie?.() ?? []
    if (all.length > 0) return all.map(c => c.split(';')[0].trim()).join('; ')
  } catch {}
  const combined = res.headers.get('set-cookie') ?? ''
  if (!combined) return ''
  return combined.split(/,(?=\s*[A-Za-z_]+=)/).map(c => c.split(';')[0].trim()).join('; ')
}

type ReceiptItem = { name: string; quantity: number; unit: string; unitPrice: number; total: number }

async function fetchPageAndSpecs(url: string): Promise<{
  items: ReceiptItem[]
  merchantName: string
  debug: string
  error?: string
}> {
  // Fetch the verification page
  const pageRes = await fetch(url, {
    headers: PAGE_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  if (!pageRes.ok) {
    return { items: [], merchantName: '', debug: `page_http=${pageRes.status}`, error: `HTTP ${pageRes.status}` }
  }

  const sessionCookies = extractCookies(pageRes)
  const finalUrl = pageRes.url || url
  const html = await pageRes.text()

  // Extract invoiceNumber and token
  const invoiceMatch = html.match(/viewModel\.InvoiceNumber\('([^']+)'\)/) ?? html.match(/viewModel\.InvoiceNumber\("([^"]+)"\)/)
  const tokenMatch = html.match(/viewModel\.Token\('([^']+)'\)/) ?? html.match(/viewModel\.Token\("([^"]+)"\)/)

  if (!invoiceMatch || !tokenMatch) {
    return { items: [], merchantName: '', debug: 'token_not_found', error: 'no_token' }
  }

  const invoiceNumber = invoiceMatch[1]
  const token = tokenMatch[1]

  // Extract merchant info
  const $ = cheerio.load(html)
  const shopName = $('#shopFullNameLabel').text().trim()
  const city = $('#cityLabel').text().trim()
  const merchantName = [shopName, city].filter(Boolean).join(', ')

  // Call specifications API
  const specsHeaders: Record<string, string> = {
    'User-Agent': PAGE_HEADERS['User-Agent'],
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': PAGE_HEADERS['Accept-Language'],
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'https://suf.purs.gov.rs',
    'Referer': finalUrl,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
  if (sessionCookies) specsHeaders['Cookie'] = sessionCookies

  const specsRes = await fetch('https://suf.purs.gov.rs/specifications', {
    method: 'POST',
    headers: specsHeaders,
    body: new URLSearchParams({ invoiceNumber, token }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  })

  const ct = specsRes.headers.get('content-type') ?? ''
  let debug = `status=${specsRes.status} ct=${ct}`

  if (!specsRes.ok) {
    return { items: [], merchantName, debug: debug + ' non_ok' }
  }

  const text = await specsRes.text()
  debug += ` body_start=${text.slice(0, 80)}`

  let data: any
  try { data = JSON.parse(text) } catch {
    return { items: [], merchantName, debug: debug + ' json_parse_failed' }
  }

  if (data?.success && Array.isArray(data.items)) {
    const items = data.items
      .filter((item: any) => item.name && Number(item.total) > 0)
      .map((item: any) => ({
        name: String(item.name).replace(/\s+/g, ' ').trim(),
        quantity: Math.round((Number(item.quantity) || 1) * 1000) / 1000,
        unit: 'KOM',
        unitPrice: Math.round((Number(item.unitPrice) || 0) * 100) / 100,
        total: Math.round((Number(item.total) || 0) * 100) / 100,
      }))
    return { items, merchantName, debug }
  }

  debug += ` success=false msg=${data?.message ?? data?.error ?? ''}`
  return { items: [], merchantName, debug }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string' || !url.includes('suf.purs.gov.rs')) {
    return NextResponse.json({ error: 'Nevažeći URL' }, { status: 400 })
  }

  let result: { items: ReceiptItem[]; merchantName: string; debug: string; error?: string } = { items: [], merchantName: '', debug: '' }

  try {
    result = await fetchPageAndSpecs(url)
  } catch (err: any) {
    await log(url, 'fetch_error', err.message, 0)
    return NextResponse.json({ error: 'Nije moguće učitati račun' }, { status: 502 })
  }

  // Retry once if no items and no hard error
  if (result.items.length === 0 && !result.error) {
    await new Promise(r => setTimeout(r, 1000))
    try {
      const retry = await fetchPageAndSpecs(url)
      if (retry.items.length > 0) result = retry
      else result.debug += ` | retry: ${retry.debug}`
    } catch {}
  }

  if (result.error === 'no_token') {
    await log(url, 'parse_error', 'invoiceNumber or token not found in HTML', 0)
    return NextResponse.json({ error: 'Nije moguće prepoznati račun' }, { status: 422 })
  }

  if (result.error?.startsWith('HTTP')) {
    await log(url, 'fetch_error', result.error, 0)
    return NextResponse.json({ error: `Greška pri učitavanju: ${result.error}` }, { status: 502 })
  }

  const totalAmount = result.items.reduce((s, i) => s + i.total, 0)
  const logStatus = result.items.length > 0 ? 'success' : 'parse_error'
  const logMsg = result.items.length === 0 ? `No items. Debug: ${result.debug}` : null
  await log(url, logStatus, logMsg, result.items.length)

  return NextResponse.json({ items: result.items, merchantName: result.merchantName, totalAmount, _debug: result.debug })
}
