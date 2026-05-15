import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function normalize(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-zа-яA-ZА-ЯčćžšđČĆŽŠĐ0-9 ]/g, '').trim()
}

export async function POST(req: NextRequest) {
  const { itemNames, categories } = await req.json()
  // categories: { id: string, name: string }[]
  // itemNames: string[]

  if (!itemNames?.length || !categories?.length) {
    return NextResponse.json({ suggestions: {} })
  }

  const db = admin()
  const suggestions: Record<string, string> = {}
  const toAsk: string[] = []

  // Check cache first
  for (const name of itemNames) {
    const key = normalize(name)
    const { data } = await db.from('item_category_cache').select('category_id').eq('item_name_normalized', key).single()
    if (data?.category_id) {
      suggestions[name] = data.category_id
    } else {
      toAsk.push(name)
    }
  }

  if (toAsk.length === 0) {
    return NextResponse.json({ suggestions })
  }

  // Call Claude Haiku for uncached items
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const catList = categories.map((c: any) => `${c.id}: ${c.name}`).join('\n')
    const itemList = toAsk.join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a household expense categorizer for a Serbian finance app. Assign each receipt item to the most fitting category.

Categories (id: name):
${catList}

Receipt items (one per line):
${itemList}

Reply with JSON only — no explanation, no markdown. Format: {"item name": "category_id", ...}
If no category fits, use the id of the most general/other category.`,
      }],
    })

    const raw = (msg.content[0] as any).text.trim()
    const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'))
    const parsed = JSON.parse(jsonStr)

    // Cache results and add to suggestions
    for (const [name, categoryId] of Object.entries(parsed)) {
      if (typeof categoryId === 'string') {
        suggestions[name] = categoryId
        const key = normalize(name)
        await db.from('item_category_cache').upsert({ item_name_normalized: key, category_id: categoryId })
      }
    }
  } catch (err) {
    // Fail silently — user can assign categories manually
    console.error('Categorization error:', err)
  }

  return NextResponse.json({ suggestions })
}
