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

  if (!itemNames?.length || !categories?.length) {
    return NextResponse.json({ suggestions: {} })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: {} })
  }

  const db = admin()
  const suggestions: Record<string, string> = {}
  const toAsk: string[] = []

  // Check cache in parallel
  const cacheResults = await Promise.all(
    itemNames.map((name: string) =>
      db.from('item_category_cache')
        .select('category_id')
        .eq('item_name_normalized', normalize(name))
        .limit(1)
        .maybeSingle()
    )
  )
  for (let i = 0; i < itemNames.length; i++) {
    const { data } = cacheResults[i]
    if (data?.category_id) {
      suggestions[itemNames[i]] = data.category_id
    } else {
      toAsk.push(itemNames[i])
    }
  }

  if (toAsk.length === 0) {
    return NextResponse.json({ suggestions })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const catList = categories.map((c: any) => `${c.id}: ${c.name}`).join('\n')
    const itemList = toAsk.join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are categorizing Serbian supermarket receipt items. Match each item to the best category.

Categories (id: name):
${catList}

Items to categorize (return EXACTLY these strings as JSON keys, character-for-character):
${itemList}

Return ONLY a JSON object, no markdown, no explanation:
{"exact item name here": "category_uuid", ...}

Use the most specific matching category. If nothing fits well, pick the most general one.`,
      }],
    })

    const raw = (msg.content[0] as any).text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      const cacheWrites: PromiseLike<any>[] = []
      for (const [name, categoryId] of Object.entries(parsed)) {
        if (typeof categoryId === 'string' && categoryId.length > 0) {
          suggestions[name] = categoryId
          cacheWrites.push(
            db.from('item_category_cache').upsert(
              { item_name_normalized: normalize(name), category_id: categoryId },
              { onConflict: 'item_name_normalized' }
            )
          )
        }
      }
      await Promise.all(cacheWrites.map(p => Promise.resolve(p).catch(() => null)))
    }
  } catch (err) {
    console.error('Categorization error:', err)
  }

  return NextResponse.json({ suggestions })
}
