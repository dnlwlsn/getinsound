import { createClient } from '@/lib/supabase/server'
import HomeClient from './components/HomeClient'

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
      .from('follows')
      .select('artist_id')
      .eq('fan_id', user.id)

    const followedIds = (follows ?? []).map((f: any) => f.artist_id)
    if (followedIds.length > 0) {
      followedArtistReleases = mapped.filter(r => followedIds.includes(r.artist_id))
    }
  }

  return (
    <HomeClient
      releases={mapped}
      isLoggedIn={!!user}
      followedArtistReleases={followedArtistReleases}
    />
  )
}
