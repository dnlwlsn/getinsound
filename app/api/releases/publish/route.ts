import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotificationBatch } from '@/lib/notifications'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 5, 1)
  if (limited) return limited

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { release_id, published } = await req.json().catch(() => ({} as any))
  if (!release_id || typeof published !== 'boolean') {
    return NextResponse.json({ error: 'release_id and published required' }, { status: 400 })
  }

  const { data: release, error: relErr } = await supabase
    .from('releases')
    .select('id, title, slug, artist_id')
    .eq('id', release_id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!release) return NextResponse.json({ error: relErr?.message ?? 'Release not found' }, { status: 404 })

  if (published) {
    const { data: account } = await supabase
      .from('artist_accounts')
      .select('stripe_onboarded')
      .eq('id', user.id)
      .maybeSingle()

    if (!account?.stripe_onboarded) {
      return NextResponse.json({ error: 'Connect your Stripe account before publishing. Go to Dashboard → Stripe Connect to get started.' }, { status: 403 })
    }

    const { count: trackCount } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .eq('release_id', release_id)
      .not('audio_path', 'is', null)

    if (!trackCount || trackCount === 0) {
      return NextResponse.json({ error: 'Upload at least one track before publishing.' }, { status: 400 })
    }

    const { data: releaseData } = await supabase
      .from('releases')
      .select('price_pence, pwyw_enabled, pwyw_minimum_pence, cover_url')
      .eq('id', release_id)
      .single()

    if (!releaseData?.cover_url) {
      return NextResponse.json({ error: 'Release must have cover art' }, { status: 400 })
    }

    const MINIMUM_PRICE_PENCE = 300
    if (releaseData && !releaseData.pwyw_enabled && (releaseData.price_pence == null || releaseData.price_pence < MINIMUM_PRICE_PENCE)) {
      return NextResponse.json({ error: 'Price must be at least £3.00. Enable "name your price" for flexible pricing.' }, { status: 400 })
    }
    if (releaseData?.pwyw_enabled) {
      const effectiveMin = releaseData.pwyw_minimum_pence ?? releaseData.price_pence ?? 0
      if (effectiveMin < MINIMUM_PRICE_PENCE) {
        return NextResponse.json({ error: 'Minimum price for name-your-price releases must be at least £3.00.' }, { status: 400 })
      }
    }
  }

  // Check current published state to avoid duplicate notifications on republish
  const { data: currentState } = await supabase
    .from('releases')
    .select('published')
    .eq('id', release_id)
    .single()
  const wasAlreadyPublished = currentState?.published === true

  const { error: updateErr } = await supabase
    .from('releases')
    .update({ published })
    .eq('id', release_id)
    .eq('artist_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (published && !wasAlreadyPublished) {
    // Check Founding Artist eligibility: Stripe verified + no existing badge
    try {
      const { data: account } = await supabase
        .from('artist_accounts')
        .select('stripe_verified')
        .eq('id', user.id)
        .maybeSingle()

      if (account?.stripe_verified) {
        const { data: existingBadge } = await supabase
          .from('fan_badges')
          .select('id')
          .eq('user_id', user.id)
          .eq('badge_type', 'founding_artist')
          .maybeSingle()

        if (!existingBadge) {
          await supabase.rpc('confirm_founding_artist', { artist_id: user.id })
        }
      }
    } catch (err) {
      console.error('Founding artist check failed:', err)
    }

    const { data: artist } = await supabase
      .from('artists')
      .select('name, slug')
      .eq('id', user.id)
      .single()

    const [buyersRes, followersRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('buyer_user_id')
        .eq('artist_id', user.id)
        .eq('status', 'paid')
        .not('buyer_user_id', 'is', null),
      supabase
        .from('fan_follows')
        .select('user_id')
        .eq('artist_id', user.id),
    ])

    if (artist) {
      const allIds = new Set<string>()
      buyersRes.data?.forEach(b => { if (b.buyer_user_id) allIds.add(b.buyer_user_id as string) })
      followersRes.data?.forEach(f => { if (f.user_id) allIds.add(f.user_id) })
      allIds.delete(user.id)

      if (allIds.size > 0) {
        await createNotificationBatch({
          supabase,
          userIds: [...allIds],
          type: 'new_release',
          title: `${artist.name} released "${release.title}"`,
          link: `/release?a=${artist.slug}&r=${release.slug}`,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
