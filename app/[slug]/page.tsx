import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ArtistProfileClient from './ArtistProfileClient'
import { FanProfileClient } from './FanProfileClient'
export const runtime = 'edge'

interface Props {
  params: Promise<{ slug: string }>
}

const STATIC_ROUTES = new Set([
  'ai-policy', 'api', 'auth', 'become-an-artist', 'components', 'dashboard',
  'discography', 'download', 'explore', 'for-artists', 'for-fans', 'for-press',
  'library', 'player', 'privacy', 'release', 'sales', 'settings', 'signup',
  'terms', 'welcome', 'why-us',
  '_not-found', '_document', '_app', '_error',
])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) return {}

  const supabase = await createClient()

  const [{ data: artist }, { data: fan }] = await Promise.all([
    supabase.from('artists').select('name, bio').eq('slug', slug).maybeSingle(),
    supabase.from('fan_profiles').select('username, bio').eq('username', slug).maybeSingle(),
  ])

  if (artist) {
    const title = `${artist.name} | insound.`
    const description = artist.bio || `Listen to ${artist.name} on Insound. Buy music directly from the artist.`
    return { title, description, openGraph: { title, description, type: 'profile' } }
  }

  if (fan) {
    const title = `${fan.username} | insound.`
    const description = fan.bio || `${fan.username}'s music collection on Insound.`
    return { title, description, openGraph: { title, description, type: 'profile' } }
  }

  return {}
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) notFound()

  const supabase = await createClient()

  // Resolve: try artist and fan in parallel (artist takes priority)
  const [{ data: artist }, { data: fan }] = await Promise.all([
    supabase.from('artists')
      .select('id, slug, name, bio, avatar_url, accent_colour')
      .eq('slug', slug).maybeSingle(),
    supabase.from('fan_profiles')
      .select('id, username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, created_at')
      .eq('username', slug).maybeSingle(),
  ])

  // ── Artist profile ────────────────────────────────────────────
  if (artist) {
    const { data: releases } = await supabase
      .from('releases')
      .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, tracks(id, title, position, duration_sec)')
      .eq('artist_id', artist.id)
      .eq('published', true)
      .order('created_at', { ascending: false })

    return (
      <ArtistProfileClient
        artist={artist}
        releases={(releases || []).map(r => ({
          ...r,
          tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
        }))}
      />
    )
  }

  // ── Fan profile ───────────────────────────────────────────────
  if (!fan) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === fan.id

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
      .select('badge_type, release_id, awarded_at')
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

  // Get unique artist IDs for The Wall
  const { data: purchaseArtistIds } = await supabase
    .from('purchases')
    .select('artist_id')
    .eq('buyer_user_id', fan.id)
    .eq('status', 'paid')

  const uniqueArtistIds = [...new Set((purchaseArtistIds || []).map(p => p.artist_id))]

  // Fetch artist posts for The Wall
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

  // Compute stats
  const artistCounts: Record<string, { name: string; count: number }> = {}
  for (const p of purchases) {
    const a = p.artists as { slug: string; name: string; accent_colour: string | null }
    if (!artistCounts[a.slug]) artistCounts[a.slug] = { name: a.name, count: 0 }
    artistCounts[a.slug].count++
  }
  const mostSupportedArtist = Object.values(artistCounts).sort((a, b) => b.count - a.count)[0] ?? null
  const uniqueArtistSlugs = new Set(Object.keys(artistCounts))
  const sortedByDate = [...purchases].filter(p => p.paid_at).sort((a, b) =>
    new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime()
  )
  const supporterSince = sortedByDate.length > 0 ? new Date(sortedByDate[0].paid_at).getFullYear() : null

  return (
    <FanProfileClient
      fan={fan}
      purchases={purchases as any}
      pinned={pinned as any}
      badges={badges}
      wallPosts={wallPosts}
      stats={{
        supporterSince,
        totalArtists: uniqueArtistSlugs.size,
        totalReleases: purchases.length,
        mostSupportedArtist,
      }}
      favouriteGenre={favouriteGenre}
      isOwner={isOwner}
    />
  )
}
