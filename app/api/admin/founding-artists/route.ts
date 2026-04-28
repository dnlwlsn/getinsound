import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { artist_name } = await req.json().catch(() => ({} as any))
  if (!artist_name) return NextResponse.json({ error: 'artist_name required' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const slug = artist_name.toLowerCase().replace(/\s+/g, '-')
  const { data: artist } = await supabaseAdmin
    .from('artists')
    .select('id, name, founding_artist')
    .or(`name.ilike.%${artist_name.replace(/[(),."']/g, '')}%,slug.eq.${slug.replace(/[(),."']/g, '')}`)
    .maybeSingle()

  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  if (artist.founding_artist) return NextResponse.json({ error: 'Already a founding artist' }, { status: 409 })

  const now = new Date().toISOString()
  const { error: updateErr } = await supabaseAdmin
    .from('artists')
    .update({ founding_artist: true, founding_artist_confirmed_at: now })
    .eq('id', artist.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const { count } = await supabaseAdmin
    .from('artists')
    .select('id', { count: 'exact', head: true })
    .eq('founding_artist', true)

  await supabaseAdmin
    .from('founding_artist_programme')
    .update({ filled_count: count ?? 0 })
    .eq('id', 1)

  await supabaseAdmin
    .from('fan_badges')
    .upsert(
      { user_id: artist.id, badge_type: 'founding_artist', metadata: { position: count } },
      { onConflict: 'user_id,badge_type' }
    )

  return NextResponse.json({ ok: true, name: artist.name })
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { artist_id } = await req.json().catch(() => ({} as any))
  if (!artist_id) return NextResponse.json({ error: 'artist_id required' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: updateErr } = await supabaseAdmin
    .from('artists')
    .update({
      founding_artist: false,
      founding_artist_confirmed_at: null,
      founding_artist_first_sale_at: null,
    })
    .eq('id', artist_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await supabaseAdmin
    .from('fan_badges')
    .delete()
    .eq('user_id', artist_id)
    .eq('badge_type', 'founding_artist')

  const { count } = await supabaseAdmin
    .from('artists')
    .select('id', { count: 'exact', head: true })
    .eq('founding_artist', true)

  await supabaseAdmin
    .from('founding_artist_programme')
    .update({ filled_count: count ?? 0 })
    .eq('id', 1)

  return NextResponse.json({ ok: true })
}
