import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotificationBatch } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { release_id, published } = await req.json().catch(() => ({} as any))
  if (!release_id || typeof published !== 'boolean') {
    return NextResponse.json({ error: 'release_id and published required' }, { status: 400 })
  }

  const { data: release, error: relErr } = await supabase
    .from('releases')
    .select('id, title, artist_id')
    .eq('id', release_id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!release) return NextResponse.json({ error: relErr?.message ?? 'Release not found' }, { status: 404 })

  const { error: updateErr } = await supabase
    .from('releases')
    .update({ published })
    .eq('id', release_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (published) {
    // Check Founding Artist eligibility: Stripe verified + first published release
    try {
      const { data: account } = await supabase
        .from('artist_accounts')
        .select('stripe_verified')
        .eq('id', user.id)
        .maybeSingle()

      if (account?.stripe_verified) {
        const { data: artistRow } = await supabase
          .from('artists')
          .select('founding_artist')
          .eq('id', user.id)
          .single()

        if (artistRow && !artistRow.founding_artist) {
          await supabase.rpc('confirm_founding_artist', { artist_id: user.id })
        }
      }
    } catch {}

    const { data: artist } = await supabase
      .from('artists')
      .select('name, slug')
      .eq('id', user.id)
      .single()

    const { data: buyers } = await supabase
      .from('purchases')
      .select('buyer_user_id')
      .eq('artist_id', user.id)
      .eq('status', 'paid')
      .not('buyer_user_id', 'is', null)

    if (buyers && buyers.length > 0 && artist) {
      const uniqueIds = [...new Set(buyers.map(b => b.buyer_user_id as string))]
      await createNotificationBatch({
        supabase,
        userIds: uniqueIds,
        type: 'new_release',
        title: `${artist.name} released "${release.title}"`,
        link: `/${artist.slug}`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
