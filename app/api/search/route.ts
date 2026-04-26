import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

type ArtistResult = {
  id: string
  slug: string
  name: string
  avatar_url: string | null
  bio: string | null
  release_count: number
}

type ReleaseResult = {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  genre: string | null
  price_pence: number
  currency: string
  artist_id: string
  artist_name: string
  artist_slug: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = searchParams.get('q') ?? ''
  const q = raw.trim().slice(0, 200)
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 50)

  if (!q) {
    return NextResponse.json({ artists: [], releases: [] })
  }

  const ip = getClientIp(request.headers)
  const ipHash = await hashIp(ip)
  const rateLimited = await checkRateLimit(ipHash, 'search', 30, 1)
  if (rateLimited) return rateLimited

  const supabase = await createClient()

  const [artistsRes, releasesRes] = await Promise.all([
    supabase.rpc('search_artists', { query: q, max_results: limit }),
    supabase.rpc('search_releases', { query: q, max_results: limit }),
  ])

  let artists: ArtistResult[] = (artistsRes.data ?? []).map(({ rank: _, ...rest }: any) => rest)
  let releases: ReleaseResult[] = (releasesRes.data ?? []).map(({ rank: _, ...rest }: any) => rest)

  if (artists.length === 0 && releases.length === 0) {
    const [fuzzyArtists, fuzzyReleases] = await Promise.all([
      supabase.rpc('search_artists_fuzzy', { query: q, max_results: limit }),
      supabase.rpc('search_releases_fuzzy', { query: q, max_results: limit }),
    ])
    artists = (fuzzyArtists.data ?? []).map(({ rank: _, ...rest }: any) => rest)
    releases = (fuzzyReleases.data ?? []).map(({ rank: _, ...rest }: any) => rest)
  }

  // Batch-fetch founding_artist badges and verification data for returned artists
  const artistIds = artists.map(a => a.id)
  let artistBadgeMap: Record<string, { badge_type: string; metadata?: any }> = {}
  let verifiedSet = new Set<string>()
  if (artistIds.length > 0) {
    const [{ data: badges }, { data: accounts }] = await Promise.all([
      supabase
        .from('fan_badges')
        .select('user_id, badge_type, metadata')
        .in('user_id', artistIds)
        .eq('badge_type', 'founding_artist'),
      supabase
        .from('artist_accounts')
        .select('id, stripe_verified, independence_confirmed')
        .in('id', artistIds),
    ])
    for (const b of badges || []) {
      artistBadgeMap[b.user_id] = { badge_type: b.badge_type, metadata: b.metadata }
    }
    for (const acc of accounts || []) {
      if (acc.stripe_verified && acc.independence_confirmed) {
        const artist = artists.find(a => a.id === acc.id)
        if (artist && artist.release_count > 0) verifiedSet.add(acc.id)
      }
    }
  }

  const artistsWithBadges = artists.map(a => ({
    ...a,
    badge: artistBadgeMap[a.id] ?? null,
    verified: verifiedSet.has(a.id),
  }))

  const { data: { user } } = await supabase.auth.getUser()
  supabase.rpc('log_search', {
    p_user_id: user?.id ?? null,
    p_query: q,
    p_results_count: artists.length + releases.length,
  }).then(() => {})

  return NextResponse.json({ artists: artistsWithBadges, releases })
}
