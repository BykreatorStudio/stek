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
    // Node 18+ supports getSetCookie()
    const all: string[] = (res.headers as any).getSetCookie?.() ?? []
    if (all.length > 0) return all.map(c => c.split(';')[0].trim()).join('; ')
  } catch {}
  // Fallback: parse combined Set-Cookie string
  const combined = res.headers.get('set-cookie') ?? ''
  if (!combined) return ''
  return combined.split(/,(?=\s*[A-Za-z_]+=)/).map(c => c.split(';')[0].trim()).join('; ')
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string' || !url.includes('suf.purs.gov.rs')) {
    return NextResponse.json({ error: 'Nevažeći URL' }, { status: 400 })
  }

  // Step 1: Fetch the verification page — save session cookies for subsequent requests
  let html = ''
  let sessionCookies = ''
  let finalUrl = url
  try {
    const res = await fetch(url, {
      headers: PAGE_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      await log(url, 'fetch_error', `HTTP ${res.status}`, 0)
      return NextResponse.json({ error: `Greška pri učitavanju: HTTP ${res.status}` }, { status: 502 })
    }
    sessionCookies = extractCookies(res)
    finalUrl = res.url || url  // final URL after redirects
    html = await res.text()
  } catch (err: any) {
    await log(url, 'fetch_error', err.message, 0)
    return NextResponse.json({ error: 'Nije moguće učitati račun' }, { status: 502 })
  }

  // Step 2: Extract invoiceNumber and token from embedded JS
  const invoiceMatch = html.match(/viewModel\.InvoiceNumber\('([^']+)'\)/) ?? html.match(/viewModel\.InvoiceNumber\("([^"]+)"\)/)
  const tokenMatch = html.match(/viewModel\.Token\('([^']+)'\)/) ?? html.match(/viewModel\.Token\("([^"]+)"\)/)

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

  // Step 4: Call the specifications API with session cookies forwarded
  let items: { name: string; quantity: number; unit: string; unitPrice: number; total: number }[] = []
  let specsDebug = ''
  try {
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

    const contentType = specsRes.headers.get('content-type') ?? ''
    specsDebug = `status=${specsRes.status} ct=${contentType}`

    if (specsRes.ok) {
      const text = await specsRes.text()
      specsDebug += ` body_start=${text.slice(0, 80)}`
      try {
        const data = JSON.parse(text)
        if (data?.success && Array.isArray(data.items)) {
          items = data.items
            .filter((item: any) => item.name && Number(item.total) > 0)
            .map((item: any) => ({
              name: String(item.name).replace(/\s+/g, ' ').trim(),
              quantity: Math.round((Number(item.quantity) || 1) * 1000) / 1000,
              unit: 'KOM',
              unitPrice: Math.round((Number(item.unitPrice) || 0) * 100) / 100,
              total: Math.round((Number(item.total) || 0) * 100) / 100,
            }))
        } else if (data && !data.success) {
          specsDebug += ` success=false msg=${data.message ?? data.error ?? ''}`
        }
      } catch {
        specsDebug += ' json_parse_failed'
      }
    } else {
      specsDebug += ` non_ok`
    }
  } catch (err: any) {
    await log(url, 'specs_error', err.message, 0)
    return NextResponse.json({ error: 'Greška pri učitavanju stavki računa' }, { status: 502 })
  }

  const totalAmount = items.reduce((s, i) => s + i.total, 0)

  const logStatus = items.length > 0 ? 'success' : 'parse_error'
  const logMsg = items.length === 0 ? `No items. Debug: ${specsDebug}` : null
  await log(url, logStatus, logMsg, items.length)

  return NextResponse.json({ items, merchantName, totalAmount, _debug: specsDebug })
}
