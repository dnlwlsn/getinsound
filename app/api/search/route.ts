import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const supabase = await createClient()

  const [artistsRes, releasesRes] = await Promise.all([
    supabase.rpc('search_artists', { query: q, max_results: limit }),
    supabase.rpc('search_releases', { query: q, max_results: limit }),
  ])

  let artists: ArtistResult[] = (artistsRes.data ?? []).map(({ rank, ...rest }) => rest)
  let releases: ReleaseResult[] = (releasesRes.data ?? []).map(({ rank, ...rest }) => rest)

  if (artists.length === 0 && releases.length === 0) {
    const [fuzzyArtists, fuzzyReleases] = await Promise.all([
      supabase.rpc('search_artists_fuzzy', { query: q, max_results: limit }),
      supabase.rpc('search_releases_fuzzy', { query: q, max_results: limit }),
    ])
    artists = (fuzzyArtists.data ?? []).map(({ rank, ...rest }) => rest)
    releases = (fuzzyReleases.data ?? []).map(({ rank, ...rest }) => rest)
  }

  const { data: { user } } = await supabase.auth.getUser()
  supabase.rpc('log_search', {
    p_user_id: user?.id ?? null,
    p_query: q,
    p_results_count: artists.length + releases.length,
  }).then(() => {})

  return NextResponse.json({ artists, releases })
}
