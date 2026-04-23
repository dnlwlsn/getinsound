import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'
import ArtistProfileClient from './ArtistProfileClient'
import { FanProfileClient } from './FanProfileClient'
export const runtime = 'edge'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  if (slug.startsWith('@')) {
    const username = slug.slice(1)
    if (!username) return {}
    const supabase = await createClient()
    const { data: fan } = await supabase
      .from('fan_profiles')
      .select('username, bio, avatar_url, is_public')
      .eq('username', username)
      .maybeSingle()
    if (!fan || !fan.is_public) return {}
    const title = `${fan.username}'s Collection | Insound`
    const description = fan.bio || `${fan.username}'s music collection on Insound.`
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        ...(fan.avatar_url ? { images: [{ url: fan.avatar_url }] } : {}),
      },
    }
  }

  if (RESERVED_SLUGS.has(slug)) return {}

  const supabase = await createClient()
  const { data: artist } = await supabase
    .from('artists')
    .select('name, bio')
    .eq('slug', slug)
    .maybeSingle()

  if (!artist) return {}

  const title = `${artist.name} | insound.`
  const description = artist.bio || `Listen to ${artist.name} on Insound. Buy music directly from the artist.`
  return { title, description, openGraph: { title, description, type: 'profile' } }
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params

  // ── Fan profile (/@username) ──────────────────────────────────
  if (slug.startsWith('@')) {
    const username = slug.slice(1)
    if (!username) notFound()

    const supabase = await createClient()
    const { data: fan } = await supabase
      .from('fan_profiles')
      .select('id, username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, show_collection, show_wall, created_at')
      .eq('username', username)
      .maybeSingle()

    if (!fan) notFound()

    const { data: { user } } = await supabase.auth.getUser()
    const isOwner = user?.id === fan.id

    if (!fan.is_public && !isOwner) notFound()

    const [purchasesRes, pinnedRes, badgesRes, prefsRes] = await Promise.all([
      supabase.from('purchases')
        .select('id, amount_pence, paid_at, releases (id, slug, title, type, cover_url, price_pence), artists (slug, name, accent_colour)')
        .eq('buyer_user_id', fan.id)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false }),
      supabase.from('fan_pinned_releases')
        .select('position, release_id, releases (id, slug, title, type, cover_url, price_pence, artists (slug, name, accent_colour))')
        .eq('user_id', fan.id)
        .order('position', { ascending: true }),
      supabase.from('fan_badges')
        .select('badge_type, release_id, awarded_at, metadata')
        .eq('user_id', fan.id),
      supabase.from('fan_preferences')
        .select('genre')
        .eq('user_id', fan.id)
        .limit(1),
    ])

    const purchases = purchasesRes.data || []
    const pinned = pinnedRes.data || []
    const badges = badgesRes.data || []
    const favouriteGenre = prefsRes.data?.[0]?.genre ?? null

    let visiblePurchases = purchases
    if (!isOwner) {
      const { data: hidden } = await supabase
        .from('fan_hidden_purchases')
        .select('purchase_id')
        .eq('user_id', fan.id)
      const hiddenIds = new Set((hidden || []).map(h => h.purchase_id))
      visiblePurchases = purchases.filter(p => !hiddenIds.has(p.id))
    }

    const { data: followedArtistIds } = await supabase
      .from('fan_follows')
      .select('artist_id')
      .eq('user_id', fan.id)

    const uniqueArtistIds = [...new Set((followedArtistIds || []).map(f => f.artist_id))]

    let wallPosts: Array<{
      id: string
      artist_id: string
      post_type: string
      content: string
      media_url: string | null
      created_at: string
      artists: { slug: string; name: string; accent_colour: string | null; avatar_url: string | null }
    }> = []

    if (uniqueArtistIds.length > 0) {
      const { data: posts } = await supabase
        .from('artist_posts')
        .select('id, artist_id, post_type, content, media_url, created_at, artists (slug, name, accent_colour, avatar_url)')
        .in('artist_id', uniqueArtistIds)
        .order('created_at', { ascending: false })
        .limit(20)

      wallPosts = (posts || []) as typeof wallPosts
    }

    const artistCounts: Record<string, { name: string; count: number }> = {}
    for (const p of visiblePurchases) {
      const a = p.artists as { slug: string; name: string; accent_colour: string | null }
      if (!artistCounts[a.slug]) artistCounts[a.slug] = { name: a.name, count: 0 }
      artistCounts[a.slug].count++
    }
    const mostSupportedArtist = Object.values(artistCounts).sort((a, b) => b.count - a.count)[0] ?? null
    const uniqueArtistSlugs = new Set(Object.keys(artistCounts))
    const sortedByDate = [...visiblePurchases].filter(p => p.paid_at).sort((a, b) =>
      new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime()
    )
    const supporterSince = sortedByDate.length > 0 ? new Date(sortedByDate[0].paid_at).getFullYear() : null

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: fan.username,
              ...(fan.avatar_url ? { image: fan.avatar_url } : {}),
              ...(fan.bio ? { description: fan.bio } : {}),
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/BuyAction',
                userInteractionCount: visiblePurchases.length,
              },
            }),
          }}
        />
        <FanProfileClient
          fan={fan as any}
          purchases={visiblePurchases as any}
          pinned={pinned as any}
          badges={badges}
          wallPosts={wallPosts}
          stats={{
            supporterSince,
            totalArtists: uniqueArtistSlugs.size,
            totalReleases: visiblePurchases.length,
            mostSupportedArtist,
          }}
          favouriteGenre={favouriteGenre}
          isOwner={isOwner}
        />
      </>
    )
  }

  // ── Artist profile (/artist-slug) ────────────────────────────
  if (RESERVED_SLUGS.has(slug)) notFound()

  const supabase = await createClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, slug, name, bio, avatar_url, banner_url, accent_colour, social_links')
    .eq('slug', slug)
    .maybeSingle()

  if (!artist) notFound()

  const [{ data: releases }, { data: artistBadges }, { data: accountData }] = await Promise.all([
    supabase
      .from('releases')
      .select('id, slug, title, type, cover_url, price_pence, currency, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, tracks(id, title, position, duration_sec), release_tags(tag)')
      .eq('artist_id', artist.id)
      .eq('published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('fan_badges')
      .select('badge_type, metadata')
      .eq('user_id', artist.id)
      .in('badge_type', ['founding_artist', 'first_sale']),
    supabase
      .from('artist_accounts')
      .select('stripe_verified, independence_confirmed')
      .eq('id', artist.id)
      .maybeSingle(),
  ])

  const releaseCount = (releases || []).length
  const isVerified = !!(accountData?.stripe_verified && accountData?.independence_confirmed && releaseCount > 0)

  return (
    <ArtistProfileClient
      artist={artist}
      releases={(releases || []).map(r => ({
        ...r,
        tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
      }))}
      badges={artistBadges || []}
      verified={isVerified}
      socialLinks={artist.social_links}
    />
  )
}
