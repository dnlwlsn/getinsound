import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReleaseClient from './ReleaseClient'

const FALLBACK_METADATA: Metadata = {
  title: 'Release | insound.',
  description:
    'Buy music directly from the artist. We only take 10% - artists keep 90%. Processing fees are on us.',
  openGraph: {
    title: 'Release | insound.',
    description:
      'Buy music directly from the artist. We only take 10% - artists keep 90%. Processing fees are on us.',
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
  const title = `${release.title} - ${artist.name} | Insound`
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

async function ReleasePageInner({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; r?: string }>
}) {
  const { a: artistSlug, r: releaseSlug } = await searchParams
  if (!artistSlug || !releaseSlug) notFound()

  const supabase = await createClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, slug, name, bio, avatar_url, accent_colour')
    .eq('slug', artistSlug)
    .maybeSingle()

  if (!artist) notFound()

  const { data: release } = await supabase
    .from('releases')
    .select('id, slug, title, type, cover_url, price_pence, currency, published, pwyw_enabled, pwyw_minimum_pence, description, genre, release_tags(tag), tracks(id, title, position, duration_sec)')
    .eq('artist_id', artist.id)
    .eq('slug', releaseSlug)
    .eq('published', true)
    .maybeSingle()

  if (!release) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwned = user
    ? await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_user_id', user.id)
        .eq('release_id', release.id)
        .eq('status', 'paid')
        .limit(1)
        .maybeSingle()
        .then(r => !!r.data)
    : false

  const [discographyRes, supportersRes, recommendationsRes] = await Promise.all([
    supabase
      .from('releases')
      .select('id, slug, title, type, cover_url, created_at, artists!inner(slug)')
      .eq('artist_id', artist.id)
      .eq('published', true)
      .neq('id', release.id)
      .order('created_at', { ascending: false })
      .limit(6),

    supabase
      .from('purchases')
      .select('buyer_user_id, paid_at')
      .eq('release_id', release.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(20),

    (() => {
      const tags = (release.release_tags ?? []).map((t: { tag: string }) => t.tag)
      if (tags.length > 0) {
        return supabase
          .from('releases')
          .select('id, slug, title, cover_url, price_pence, currency, artists!inner(name, slug)')
          .eq('published', true)
          .neq('id', release.id)
          .neq('artist_id', artist.id)
          .limit(8)
      }
      if (release.genre) {
        return supabase
          .from('releases')
          .select('id, slug, title, cover_url, price_pence, currency, artists!inner(name, slug)')
          .eq('published', true)
          .eq('genre', release.genre)
          .neq('id', release.id)
          .neq('artist_id', artist.id)
          .order('created_at', { ascending: false })
          .limit(8)
      }
      return Promise.resolve({ data: [] })
    })(),
  ])

  const discography = (discographyRes.data ?? []).map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    type: r.type,
    cover_url: r.cover_url,
    artistSlug: Array.isArray(r.artists) ? r.artists[0].slug : r.artists.slug,
  }))

  const supporterPurchases = supportersRes.data ?? []
  const buyerIds = supporterPurchases
    .map((p: any) => p.buyer_user_id)
    .filter((id: string | null): id is string => !!id)
  const uniqueBuyerIds = [...new Set(buyerIds)]

  let usernameMap: Record<string, string> = {}
  if (uniqueBuyerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('fan_profiles')
      .select('id, username')
      .in('id', uniqueBuyerIds)
    if (profiles) {
      usernameMap = Object.fromEntries(
        profiles.map((p: any) => [p.id, p.username])
      )
    }
  }

  const supporters = supporterPurchases
    .map((p: any) => {
      const name = (p.buyer_user_id && usernameMap[p.buyer_user_id]) || null
      if (!name) return null
      return { name, paidAt: p.paid_at }
    })
    .filter((s: any): s is { name: string; paidAt: string | null } => s !== null)

  const recommendations = (recommendationsRes.data ?? []).map((r: any) => {
    const a = Array.isArray(r.artists) ? r.artists[0] : r.artists
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      cover_url: r.cover_url,
      price_pence: r.price_pence,
      currency: r.currency,
      artistName: a.name,
      artistSlug: a.slug,
    }
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicRelease',
    name: release.title,
    byArtist: { '@type': 'MusicGroup', name: artist.name },
    image: release.cover_url,
    offers: {
      '@type': 'Offer',
      price: (release.price_pence / 100).toFixed(2),
      priceCurrency: release.currency || 'GBP',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ReleaseClient artist={artist} release={release} discography={discography} supporters={supporters} recommendations={recommendations} isOwned={isOwned} />
    </>
  )
}

export default async function ReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; r?: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-6 py-24 text-center text-zinc-600 font-bold text-sm">
          Loading...
        </div>
      }
    >
      <ReleasePageInner searchParams={searchParams} />
    </Suspense>
  )
}
