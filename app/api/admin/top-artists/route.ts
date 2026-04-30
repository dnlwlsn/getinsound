import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: purchases } = await supabase
    .from('purchases')
    .select('artist_id, amount_pence, artists(name, slug, avatar_url)')
    .eq('status', 'paid')

  const artistMap = new Map<string, { name: string; slug: string; avatar: string | null; sales: number; revenue: number }>()

  for (const p of purchases ?? []) {
    const artist = p.artists as unknown as { name: string; slug: string; avatar_url: string | null }
    if (!artist) continue
    const existing = artistMap.get(p.artist_id)
    if (existing) {
      existing.sales++
      existing.revenue += p.amount_pence
    } else {
      artistMap.set(p.artist_id, {
        name: artist.name,
        slug: artist.slug,
        avatar: artist.avatar_url,
        sales: 1,
        revenue: p.amount_pence,
      })
    }
  }

  const artists = [...artistMap.values()]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10)

  return NextResponse.json({ artists })
}
