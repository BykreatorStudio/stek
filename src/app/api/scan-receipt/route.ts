import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

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
      signal: AbortSignal.timeout(12000),
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

  // Strip scripts and styles to reduce token count, keep structural HTML
  const $ = cheerio.load(html)
  $('script, style, noscript, link, meta, svg').remove()
  const cleanHtml = $.html().replace(/\s{2,}/g, ' ').trim().slice(0, 60000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are extracting data from a Serbian fiscal receipt verification page (suf.purs.gov.rs).

Return ONLY valid JSON, no explanation, no markdown:
{
  "merchantName": "store/company name or empty string",
  "items": [
    {"name": "item name", "quantity": 1.0, "unit": "KOM", "unitPrice": 100.0, "total": 100.0}
  ]
}

Rules:
- quantity, unitPrice, total must be numbers (use . for decimals, not ,)
- unit is typically KOM, kg, l, g, etc.
- if item has no separate quantity/unitPrice, set quantity=1 and unitPrice=total
- if no items found, return {"merchantName": "", "items": []}

HTML:
${cleanHtml}`,
      }],
    })

    const raw = (msg.content[0] as any).text.trim()
    const jsonStart = raw.indexOf('{')
    const parsed = JSON.parse(raw.slice(jsonStart))

    const items = (parsed.items ?? []).map((item: any) => ({
      name: String(item.name ?? '').replace(/\s+/g, ' ').trim(),
      quantity: Math.round((Number(item.quantity) || 1) * 100) / 100,
      unit: String(item.unit || 'KOM').toUpperCase(),
      unitPrice: Math.round((Number(item.unitPrice) || 0) * 100) / 100,
      total: Math.round((Number(item.total) || 0) * 100) / 100,
    })).filter((i: any) => i.name && i.total > 0)

    const merchantName = String(parsed.merchantName ?? '').trim()
    const totalAmount = items.reduce((s: number, i: any) => s + i.total, 0)

    await log(url, items.length > 0 ? 'success' : 'parse_error',
      items.length === 0 ? 'Claude found no items' : null, items.length)

    return NextResponse.json({ items, merchantName, totalAmount })
  } catch (err: any) {
    await log(url, 'claude_error', err.message, 0)
    return NextResponse.json({ error: 'Greška pri čitanju računa' }, { status: 500 })
  }
}
