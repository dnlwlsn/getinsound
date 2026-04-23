import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DiscoverClient from './DiscoverClient'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Discover | insound.',
  description:
    'Discover new music from independent artists. Hand-picked selections, new releases, and artist recommendations — all on insound.',
  openGraph: {
    title: 'Discover | insound.',
    description:
      'Discover new music from independent artists. Hand-picked selections, new releases, and artist recommendations.',
    type: 'website',
  },
}

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekOfStr = weekStart.toISOString().slice(0, 10)

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [featuredRes, newReleasesRes, recommendationsRes, fanPrefsRes] = await Promise.all([
    supabase
      .from('featured_artists')
      .select(`
        id, week_of, editorial_note,
        artists!inner ( id, slug, name, avatar_url, accent_colour ),
        releases:artists!inner ( releases ( id, slug, title, type, cover_url, genre, price_pence ) )
      `)
      .eq('week_of', weekOfStr)
      .maybeSingle(),

    supabase
      .from('releases')
      .select(`
        id, slug, title, type, cover_url, genre, price_pence, created_at,
        artists!inner ( id, name, slug, accent_colour )
      `)
      .eq('published', true)
      .gte('created_at', sevenDaysAgo)
      .order('type', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(48),

    supabase
      .from('artist_recommendations')
      .select(`
        id, recommender_id, recommended_id,
        recommender:artists!recommender_id ( id, slug, name, avatar_url, accent_colour ),
        recommended:artists!recommended_id ( id, slug, name, avatar_url, accent_colour )
      `)
      .limit(30),

    user
      ? supabase.from('fan_preferences').select('genre').eq('user_id', user.id)
      : Promise.resolve({ data: null }),
  ])

  const fanGenres = fanPrefsRes.data?.map((p: { genre: string }) => p.genre) ?? []

  return (
    <DiscoverClient
      featured={featuredRes.data}
      newReleases={newReleasesRes.data ?? []}
      recommendations={recommendationsRes.data ?? []}
      fanGenres={fanGenres}
      isLoggedIn={!!user}
    />
  )
}
