import { createClient } from '@/lib/supabase/server'
import HomeClient from './components/HomeClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Insound - Independent music, fairly traded',
  description: 'Discover and buy music directly from independent artists. Artists keep 90% of every sale. No subscriptions, no algorithms - just great music.',
  openGraph: {
    title: 'Insound - Independent music, fairly traded',
    description: 'Discover and buy music directly from independent artists. Artists keep 90% of every sale.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
  },
}

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: releases } = await supabase
    .from('releases')
    .select(`
      id, slug, title, type, cover_url, genre, price_pence, created_at,
      artists!inner ( id, name, slug, accent_colour ),
      release_tags ( tag )
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(60)

  const mapped = (releases ?? []).map((r: any) => {
    const artist = Array.isArray(r.artists) ? r.artists[0] : r.artists
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      type: r.type,
      cover_url: r.cover_url,
      genre: r.genre ?? null,
      price_pence: r.price_pence,
      created_at: r.created_at,
      artist_id: artist.id,
      artist_name: artist.name,
      artist_slug: artist.slug,
      accent_colour: artist.accent_colour ?? null,
      tags: (r.release_tags ?? []).map((t: { tag: string }) => t.tag),
      isNew: new Date(r.created_at) >= new Date(sevenDaysAgo),
    }
  })

  let followedArtistReleases: typeof mapped = []
  if (user) {
    const { data: follows } = await supabase
      .from('fan_follows')
      .select('artist_id')
      .eq('user_id', user.id)

    const followedIds = (follows ?? []).map((f: any) => f.artist_id)
    if (followedIds.length > 0) {
      followedArtistReleases = mapped.filter(r => followedIds.includes(r.artist_id))
    }
  }

  // Recent activity for social proof
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: recentPurchases }, { data: recentFollows }] = await Promise.all([
    supabase
      .from('purchases')
      .select('created_at, releases ( title, slug, cover_url ), artists!inner ( name, slug )')
      .eq('status', 'paid')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('fan_follows')
      .select('created_at, artists!inner ( name, slug )')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const activityItems = [
    ...(recentPurchases ?? []).map((p: any) => {
      const release = Array.isArray(p.releases) ? p.releases[0] : p.releases
      const artist = Array.isArray(p.artists) ? p.artists[0] : p.artists
      return {
        type: 'purchase' as const,
        created_at: p.created_at,
        release_title: release?.title,
        release_slug: release?.slug,
        cover_url: release?.cover_url ?? undefined,
        artist_name: artist?.name,
        artist_slug: artist?.slug,
      }
    }).filter(p => p.release_title && p.artist_name),
    ...(recentFollows ?? []).map((f: any) => {
      const artist = Array.isArray(f.artists) ? f.artists[0] : f.artists
      return {
        type: 'follow' as const,
        created_at: f.created_at,
        artist_name: artist?.name,
        artist_slug: artist?.slug,
      }
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)

  const soundCounts = new Map<string, number>()
  for (const r of mapped) {
    if (r.genre) soundCounts.set(r.genre, (soundCounts.get(r.genre) || 0) + 1)
    for (const t of r.tags) soundCounts.set(t, (soundCounts.get(t) || 0) + 1)
  }
  const popularSounds = [...soundCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  return (
    <HomeClient
      releases={mapped}
      isLoggedIn={!!user}
      followedArtistReleases={followedArtistReleases}
      activityItems={activityItems}
      userEmail={user?.email ?? null}
      popularSounds={popularSounds}
    />
  )
}
