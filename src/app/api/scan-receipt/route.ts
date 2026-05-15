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

function parseSrbNum(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100) / 100 || 0
}

function extractMerchantFromJournal(journal: string): string {
  const lines = journal.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{9}$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        if (!/^[=\-*\s]+$/.test(lines[j])) return lines[j]
      }
    }
  }
  return ''
}

function parseJournal(journal: string): ReceiptItem[] {
  const items: ReceiptItem[] = []
  const lines = journal.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)

  let inItems = false
  let pendingName = ''

  for (const line of lines) {
    // Start of items section
    if (/арти[кц]ли/iu.test(line) || /^artikli/iu.test(line)) {
      inItems = true
      pendingName = ''
      continue
    }

    // End of items section
    if (inItems && /^(укупан|укупно|ukupan|ukupno|рабат|rabat|пдв|pdv|порез|porez|готовина|gotovina|картица|kartica|повраћај|povracaj)/iu.test(line)) {
      break
    }

    if (!inItems) continue
    if (/^[=\-*\s]+$/.test(line)) continue

    // Pattern 1 (single line with * or x): "NAME  QTY UNIT * PRICE = TOTAL [VAT]"
    const p1 = /^(.+?)\s+([\d.,]+)\s+([A-Za-zКОМкомШТшт\.]+)\s*[*×xX]\s*([\d.,]+)\s*=?\s*([\d.,]+)\s*[A-GŠЕАБВГД]?\s*$/i.exec(line)
    if (p1) {
      const name = p1[1].trim()
      const qty = parseSrbNum(p1[2])
      const unitPrice = parseSrbNum(p1[4])
      const total = parseSrbNum(p1[5])
      if (name.length > 1 && total > 0 && !/^[=\-*]+$/.test(name)) {
        items.push({ name, quantity: qty || 1, unit: p1[3].toUpperCase(), unitPrice, total })
        pendingName = ''
        continue
      }
    }

    // Pattern 2 (single line no * =): "NAME  QTY UNIT  UNIT_PRICE  TOTAL [VAT]"
    const p2 = /^(.+?)\s+([\d.,]+)\s+([A-Za-zКОМкомШТшт\.]+)\s+([\d.,]+)\s+([\d.,]+)\s*[A-GŠЕАБВГД]?\s*$/i.exec(line)
    if (p2) {
      const name = p2[1].trim()
      const qty = parseSrbNum(p2[2])
      const unitPrice = parseSrbNum(p2[4])
      const total = parseSrbNum(p2[5])
      if (name.length > 1 && total > 0 && qty > 0 && qty < 100000 && !/^[=\-*]+$/.test(name)) {
        items.push({ name, quantity: qty, unit: p2[3].toUpperCase(), unitPrice, total })
        pendingName = ''
        continue
      }
    }

    // Pattern 3 (detail line for multi-line format): "QTY UNIT * PRICE = TOTAL [VAT]"
    const p3 = /^([\d.,]+)\s+([A-Za-zКОМкомШТшт\.]+)\s*[*×xX]?\s*([\d.,]+)\s*=?\s*([\d.,]+)\s*[A-GŠЕАБВГД]?\s*$/i.exec(line)
    if (p3 && pendingName) {
      const qty = parseSrbNum(p3[1])
      const unitPrice = parseSrbNum(p3[3])
      const total = parseSrbNum(p3[4])
      if (total > 0) {
        items.push({ name: pendingName, quantity: qty || 1, unit: p3[2].toUpperCase(), unitPrice, total })
        pendingName = ''
        continue
      }
    }

    // Pattern 4 (total-only detail line): "TOTAL [VAT]" when pendingName is set
    const p4 = /^([\d.,]+)\s*[A-GŠЕАБВГД]\s*$/.exec(line)
    if (p4 && pendingName) {
      const total = parseSrbNum(p4[1])
      if (total > 0) {
        items.push({ name: pendingName, quantity: 1, unit: 'KOM', unitPrice: total, total })
        pendingName = ''
        continue
      }
    }

    // Candidate name line — pure text or text with minimal digits
    const digitCount = (line.match(/\d/g) ?? []).length
    if (line.length > 1 && digitCount <= 2 && !/^[=\-*:]+$/.test(line)) {
      pendingName = line
    } else {
      pendingName = ''
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

  const rawItems = result?.items ?? result?.Items ?? result?.stavke ?? result?.Stavke ?? null
  const firstItemDump = rawItems?.[0] ? JSON.stringify(rawItems[0]).slice(0, 300) : null

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const items = rawItems
      .filter((i: any) => Number(i.total ?? i.Total ?? i.ukupno ?? i.Ukupno ?? i.amount ?? i.Amount) > 0)
      .map((i: any) => ({
        name: String(
          i.name ?? i.Name ?? i.naziv ?? i.Naziv ?? i.description ?? i.Description ??
          i.itemName ?? i.articleName ?? i.goodsName ?? i.productName ?? i.roba ?? 'Artikal'
        ).replace(/\s+/g, ' ').trim(),
        quantity: Math.round((Number(i.quantity ?? i.Quantity ?? i.kolicina ?? i.Kolicina) || 1) * 1000) / 1000,
        unit: i.unit ?? i.Unit ?? i.jedinica ?? 'KOM',
        unitPrice: Math.round((Number(i.unitPrice ?? i.UnitPrice ?? i.jedinicnaCena ?? i.price ?? i.Price) || 0) * 100) / 100,
        total: Math.round((Number(i.total ?? i.Total ?? i.ukupno ?? i.Ukupno ?? i.amount ?? i.Amount) || 0) * 100) / 100,
      }))
    return { items, merchantName, debug: debug + ` structured items=${items.length} first=${firstItemDump}` }
  }

  // Fall back to journal parsing
  const journal = result?.journal ?? result?.Journal ?? data?.journal ?? ''
  const topKeys = Object.keys(data ?? {}).join(',')
  const resultKeys = result && result !== data ? Object.keys(result).join(',') : ''
  if (journal) {
    const items = parseJournal(journal)
    const journalMerchant = extractMerchantFromJournal(journal)
    const resolvedMerchant = merchantName || journalMerchant
    const journalSnippet = journal.replace(/\r/g, '').slice(0, 1500)
    return { items, merchantName: resolvedMerchant, debug: debug + ` journal_parsed items=${items.length} merchant=${resolvedMerchant} topKeys=${topKeys} resultKeys=${resultKeys} journal=<<${journalSnippet}>>` }
  }

  return { items: [], merchantName, debug: debug + ` no_items topKeys=${topKeys} resultKeys=${resultKeys}` }
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
