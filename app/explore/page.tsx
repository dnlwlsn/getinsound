import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ExploreClient from './ExploreClient'

export const metadata: Metadata = {
  title: 'Explore | insound.',
  description:
    'Explore music from independent artists. Buy direct, pay fair — we only take 10%. Every fee shown transparently at checkout.',
  openGraph: {
    title: 'Explore | insound.',
    description:
      'Explore music from independent artists. Buy direct, pay fair — we only take 10%. Every fee shown transparently at checkout.',
    type: 'website',
  },
}

export default async function ExplorePage() {
  const supabase = await createClient()

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

  return <ExploreClient releases={mapped} />
}
