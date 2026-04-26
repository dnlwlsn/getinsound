import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ReleaseClient from './ReleaseClient'

const FALLBACK_METADATA: Metadata = {
  title: 'Release | insound.',
  description:
    'Buy music directly from the artist. We only take 10%. Every fee shown transparently at checkout.',
  openGraph: {
    title: 'Release | insound.',
    description:
      'Buy music directly from the artist. We only take 10%. Every fee shown transparently at checkout.',
    type: 'website',
  },
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; r?: string }>
}): Promise<Metadata> {
  const { a: artistSlug, r: releaseSlug } = await searchParams
  if (!artistSlug || !releaseSlug) return FALLBACK_METADATA

  const supabase = await createClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name, slug')
    .eq('slug', artistSlug)
    .maybeSingle()

  if (!artist) return FALLBACK_METADATA

  const { data: release } = await supabase
    .from('releases')
    .select('title, type, cover_url')
    .eq('artist_id', artist.id)
    .eq('slug', releaseSlug)
    .eq('published', true)
    .maybeSingle()

  if (!release) return FALLBACK_METADATA

  const typeLabel =
    { single: 'Single', ep: 'EP', album: 'Album' }[release.type as string] || 'Release'
  const title = `${release.title} — ${artist.name} | Insound`
  const description = `${typeLabel} by ${artist.name}. Buy music directly from the artist on Insound.`

  const ogImages: { url: string; width: number; height: number; alt: string }[] = []

  const ogUrl = new URL('/api/og', 'https://getinsound.com')
  ogUrl.searchParams.set('title', release.title)
  ogUrl.searchParams.set('artist', artist.name)
  ogUrl.searchParams.set('type', 'release')
  if (release.cover_url) ogUrl.searchParams.set('cover', release.cover_url)
  ogImages.push({ url: ogUrl.toString(), width: 1200, height: 630, alt: title })

  if (release.cover_url) {
    ogImages.push({ url: release.cover_url, width: 1200, height: 1200, alt: `${release.title} cover art` })
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'music.album',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.length > 0 ? [ogImages[0].url] : undefined,
    },
  }
}

export default function ReleasePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-6 py-24 text-center text-zinc-600 font-bold text-sm">
          Loading...
        </div>
      }
    >
      <ReleaseClient />
    </Suspense>
  )
}
