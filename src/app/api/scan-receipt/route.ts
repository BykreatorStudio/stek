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

type ReceiptItem = { name: string; quantity: number; unit: string; unitPrice: number; total: number }

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

function extractCookies(res: Response): string {
  try {
    const all: string[] = (res.headers as any).getSetCookie?.() ?? []
    if (all.length > 0) return all.map(c => c.split(';')[0].trim()).join('; ')
  } catch {}
  const combined = res.headers.get('set-cookie') ?? ''
  if (!combined) return ''
  return combined.split(/,(?=\s*[A-Za-z_]+=)/).map(c => c.split(';')[0].trim()).join('; ')
}

// Parse items from journal text (plain text receipt format)
function parseJournal(journal: string): ReceiptItem[] {
  const items: ReceiptItem[] = []
  const lines = journal.split('\n').map(l => l.trim()).filter(Boolean)

  // Find item lines — pattern: name + quantity + unit price + total
  // Serbian receipt format: "Naziv artikla   1 KOM  100,00  100,00"
  const itemPattern = /^(.+?)\s+([\d,]+)\s+(\w+)\s+([\d.,]+)\s+([\d.,]+)\s*[A-GŠ]\s*$/
  const simplePattern = /^(.+?)\s+([\d,]+)\s+([\d.,]+)\s*$/

  for (const line of lines) {
    const m = itemPattern.exec(line)
    if (m) {
      const name = m[1].trim()
      const quantity = parseFloat(m[2].replace(',', '.')) || 1
      const unitPrice = parseFloat(m[4].replace('.', '').replace(',', '.')) || 0
      const total = parseFloat(m[5].replace('.', '').replace(',', '.')) || 0
      if (name && total > 0 && name.length > 1 && !/^[-=*]+$/.test(name)) {
        items.push({ name, quantity, unit: m[3] || 'KOM', unitPrice, total })
      }
      continue
    }
    const s = simplePattern.exec(line)
    if (s) {
      const name = s[1].trim()
      const quantity = parseFloat(s[2].replace(',', '.')) || 1
      const total = parseFloat(s[3].replace('.', '').replace(',', '.')) || 0
      if (name && total > 0 && name.length > 1 && !/^[-=*:]+$/.test(name) && !/ukupno|pdv|porez|total|zbir/i.test(name)) {
        items.push({ name, quantity, unit: 'KOM', unitPrice: total / quantity, total })
      }
    }
  }
  return items
}

// Strategy 1: GET with Accept: application/json — single request, no session dance
async function tryJsonApi(url: string): Promise<{ items: ReceiptItem[]; merchantName: string; debug: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Accept-Language': 'sr-RS,sr;q=0.9',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  const ct = res.headers.get('content-type') ?? ''
  const debug = `json_api status=${res.status} ct=${ct}`

  if (!res.ok) return { items: [], merchantName: '', debug: debug + ' non_ok' }

  const text = await res.text()
  const snippet = text.slice(0, 120)

  if (!ct.includes('json')) return { items: [], merchantName: '', debug: debug + ` not_json snippet=${snippet}` }

  let data: any
  try { data = JSON.parse(text) } catch {
    return { items: [], merchantName: '', debug: debug + ' parse_fail' }
  }

  // Try structured items from invoiceResult
  const result = data?.invoiceResult ?? data?.InvoiceResult ?? data
  const merchantName = result?.merchantName ?? result?.MerchantName ?? result?.companyName ?? ''

  if (Array.isArray(result?.items) && result.items.length > 0) {
    const items = result.items
      .filter((i: any) => i.name && Number(i.total ?? i.amount) > 0)
      .map((i: any) => ({
        name: String(i.name ?? i.Name).replace(/\s+/g, ' ').trim(),
        quantity: Math.round((Number(i.quantity ?? i.Quantity) || 1) * 1000) / 1000,
        unit: i.unit ?? i.Unit ?? 'KOM',
        unitPrice: Math.round((Number(i.unitPrice ?? i.UnitPrice ?? i.price) || 0) * 100) / 100,
        total: Math.round((Number(i.total ?? i.Total ?? i.amount) || 0) * 100) / 100,
      }))
    return { items, merchantName, debug: debug + ` structured_items=${items.length}` }
  }

  // Fall back to journal parsing
  const journal = result?.journal ?? result?.Journal ?? data?.journal ?? ''
  if (journal) {
    const items = parseJournal(journal)
    return { items, merchantName, debug: debug + ` journal_parsed items=${items.length} journal_len=${journal.length}` }
  }

  return { items: [], merchantName, debug: debug + ` no_items keys=${Object.keys(data ?? {}).join(',')}` }
}

// Strategy 2: HTML page + /specifications POST (original approach)
async function trySpecsApi(url: string): Promise<{ items: ReceiptItem[]; merchantName: string; debug: string }> {
  const PAGE_HEADERS = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sr-RS,sr;q=0.9,en-US;q=0.8',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
  }

  const pageRes = await fetch(url, { headers: PAGE_HEADERS, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!pageRes.ok) return { items: [], merchantName: '', debug: `specs page_http=${pageRes.status}` }

  const sessionCookies = extractCookies(pageRes)
  const finalUrl = pageRes.url || url
  const html = await pageRes.text()

  const invoiceMatch = html.match(/viewModel\.InvoiceNumber\('([^']+)'\)/) ?? html.match(/viewModel\.InvoiceNumber\("([^"]+)"\)/)
  const tokenMatch = html.match(/viewModel\.Token\('([^']+)'\)/) ?? html.match(/viewModel\.Token\("([^"]+)"\)/)
  if (!invoiceMatch || !tokenMatch) return { items: [], merchantName: '', debug: 'specs no_token' }

  const $ = cheerio.load(html)
  const merchantName = [$('#shopFullNameLabel').text().trim(), $('#cityLabel').text().trim()].filter(Boolean).join(', ')

  const specsRes = await fetch('https://suf.purs.gov.rs/specifications', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'sr-RS,sr;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://suf.purs.gov.rs',
      'Referer': finalUrl,
      ...(sessionCookies ? { 'Cookie': sessionCookies } : {}),
    },
    body: new URLSearchParams({ invoiceNumber: invoiceMatch[1], token: tokenMatch[1] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  })

  const ct = specsRes.headers.get('content-type') ?? ''
  const text = await specsRes.text()
  const debug = `specs status=${specsRes.status} ct=${ct} body=${text.slice(0, 80)}`

  let data: any
  try { data = JSON.parse(text) } catch { return { items: [], merchantName, debug: debug + ' parse_fail' } }

  if (data?.success && Array.isArray(data.items)) {
    const items = data.items
      .filter((i: any) => i.name && Number(i.total) > 0)
      .map((i: any) => ({
        name: String(i.name).replace(/\s+/g, ' ').trim(),
        quantity: Math.round((Number(i.quantity) || 1) * 1000) / 1000,
        unit: 'KOM',
        unitPrice: Math.round((Number(i.unitPrice) || 0) * 100) / 100,
        total: Math.round((Number(i.total) || 0) * 100) / 100,
      }))
    return { items, merchantName, debug }
  }

  return { items: [], merchantName, debug: debug + ` success=false msg=${data?.message ?? ''}` }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string' || !url.includes('suf.purs.gov.rs')) {
    return NextResponse.json({ error: 'Nevažeći URL' }, { status: 400 })
  }

  let items: ReceiptItem[] = []
  let merchantName = ''
  let debug = ''

  try {
    // Strategy 1: direct JSON API (no session, no POST)
    const r1 = await tryJsonApi(url)
    debug = r1.debug
    items = r1.items
    merchantName = r1.merchantName

    // Strategy 2: fallback to specs if JSON API returned nothing
    if (items.length === 0) {
      const r2 = await trySpecsApi(url)
      debug += ' | ' + r2.debug
      items = r2.items
      if (r2.merchantName) merchantName = r2.merchantName
    }
  } catch (err: any) {
    await log(url, 'fetch_error', err.message, 0)
    return NextResponse.json({ error: 'Nije moguće učitati račun' }, { status: 502 })
  }

  const logStatus = items.length > 0 ? 'success' : 'parse_error'
  await log(url, logStatus, items.length === 0 ? `No items. ${debug}` : null, items.length)

  if (items.length === 0) {
    return NextResponse.json({
      error: 'Nisu pronađene stavke na računu.',
      _debug: debug,
    }, { status: 422 })
  }

  return NextResponse.json({ items, merchantName, totalAmount: items.reduce((s, i) => s + i.total, 0), _debug: debug })
}
