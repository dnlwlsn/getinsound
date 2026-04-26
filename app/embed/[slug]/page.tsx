import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmbedClient } from './EmbedClient'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: release } = await supabase
    .from('releases')
    .select('title, artists ( name )')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!release) return { title: 'Embed | insound.' }

  const artistName = (release.artists as any)?.name ?? 'Unknown Artist'
  return {
    title: `${release.title} by ${artistName} | insound.`,
    description: `Listen to ${release.title} by ${artistName} on insound.`,
  }
}

export default async function EmbedPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: release, error } = await supabase
    .from('releases')
    .select(`
      id, slug, title, type, cover_url, price_pence, currency,
      artists ( id, slug, name, accent_colour ),
      tracks ( id, title, position, duration_sec )
    `)
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !release) notFound()

  const artist = release.artists as any
  const tracks = ((release.tracks as any[]) || []).sort(
    (a: any, b: any) => a.position - b.position
  )

  return (
    <EmbedClient
      release={{
        slug: release.slug,
        title: release.title,
        type: release.type,
        coverUrl: release.cover_url,
        pricePence: release.price_pence,
        currency: release.currency ?? 'GBP',
      }}
      artist={{
        slug: artist?.slug ?? '',
        name: artist?.name ?? 'Unknown Artist',
        accentColour: artist?.accent_colour ?? null,
      }}
      tracks={tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        durationSec: t.duration_sec,
      }))}
    />
  )
}
