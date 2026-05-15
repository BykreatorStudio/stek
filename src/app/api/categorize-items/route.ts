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
    return NextResponse.json({ suggestions: [] })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: [] })
  }

  const db = admin()
  const validIds = new Set(categories.map((c: any) => c.id))

  // Result array — one category ID per item (empty string = no match)
  const result: string[] = new Array(itemNames.length).fill('')
  const uncachedIndices: number[] = []

  // Parallel cache lookup — only use cached IDs that still exist in current categories
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
    const catId = cacheResults[i].data?.category_id
    if (catId && validIds.has(catId)) {
      result[i] = catId
    } else {
      uncachedIndices.push(i)
    }
  }

  if (uncachedIndices.length === 0) {
    return NextResponse.json({ suggestions: result })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const catList = categories.map((c: any) => `${c.id} — ${c.name}`).join('\n')
    const itemList = uncachedIndices.map((i, j) => `${j + 1}. ${itemNames[i]}`).join('\n')
    const count = uncachedIndices.length

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are categorizing Serbian supermarket receipt items. Assign each item to the most fitting category.

Available categories:
${catList}

Items to categorize:
${itemList}

Return ONLY a JSON array with exactly ${count} category IDs, one per item, in the same order.
Use empty string "" if no category fits well.
Example for ${count} items: ${JSON.stringify(new Array(count).fill('category-uuid-here'))}`,
      }],
    })

    const raw = (msg.content[0] as any).text ?? ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed: string[] = JSON.parse(match[0])
      const cacheWrites: PromiseLike<any>[] = []

      for (let j = 0; j < uncachedIndices.length; j++) {
        const i = uncachedIndices[j]
        const catId = typeof parsed[j] === 'string' ? parsed[j] : ''
        result[i] = catId
        if (catId) {
          cacheWrites.push(
            db.from('item_category_cache').upsert(
              { item_name_normalized: normalize(itemNames[i]), category_id: catId },
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

  return NextResponse.json({ suggestions: result })
}
