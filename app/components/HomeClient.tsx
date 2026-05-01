'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'
import { generateGradientDataUri } from '@/lib/gradient'
import { SocialProofStrip, type ActivityItem } from './ui/SocialProofStrip'
import { NewsletterSignup } from './ui/NewsletterSignup'
import { Shelf, ShelfCard } from './ui/Shelf'
import { ContextMenu } from './ui/ContextMenu'
import { getRecentlyPlayedReleases } from '@/lib/stores/history'

interface Release {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  genre: string | null
  price_pence: number
  created_at: string
  artist_id: string
  artist_name: string
  artist_slug: string
  accent_colour: string | null
  tags: string[]
  isNew: boolean
}

interface HomeClientProps {
  releases: Release[]
  isLoggedIn: boolean
  followedArtistReleases: Release[]
  activityItems: ActivityItem[]
  userEmail: string | null
  popularSounds?: string[]
}

const PAGE_SIZE = 20

function releaseUrl(r: Release) {
  return `/release?a=${r.artist_slug}&r=${r.slug}`
}

function coverSrc(r: Release) {
  return r.cover_url || generateGradientDataUri(r.artist_id, r.id)
}

function releaseContextItems(r: Release) {
  return [
    {
      label: 'Go to release',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>,
      href: releaseUrl(r),
    },
    {
      label: 'Go to artist',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>,
      href: `/${r.artist_slug}`,
    },
    { divider: true, label: '' },
    {
      label: 'Share',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>,
      onClick: () => {
        if (navigator.share) {
          navigator.share({ title: r.title, url: `${window.location.origin}${releaseUrl(r)}` }).catch(() => {})
        } else {
          navigator.clipboard.writeText(`${window.location.origin}${releaseUrl(r)}`).catch(() => {})
        }
      },
    },
  ]
}

function ReleaseGrid({ releases, formatPrice, convertPrice, currency }: {
  releases: Release[]
  formatPrice: (n: number) => string
  convertPrice: (amount: number, from: string, to: string) => number
  currency: string
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
      {releases.map(r => (
        <ContextMenu key={r.id} items={releaseContextItems(r)}>
          <Link href={releaseUrl(r)} className="group flex flex-col h-full">
            <div className="aspect-square rounded-2xl overflow-hidden mb-3 ring-1 ring-white/[0.06] relative">
              <Image
                src={coverSrc(r)}
                alt={`${r.title} by ${r.artist_name}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
              />
              {r.isNew && (
                <span className="absolute top-2 left-2 bg-orange-600 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  New
                </span>
              )}
            </div>
            <p className="font-display font-bold text-sm text-white truncate">{r.title}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{r.artist_name}</p>
            <div className="flex-1" />
            <span className="inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 rounded-full self-start">
              {formatPrice(convertPrice(r.price_pence / 100, 'GBP', currency))}
            </span>
          </Link>
        </ContextMenu>
      ))}
    </div>
  )
}

function FeaturedHero({ releases, formatPrice, convertPrice, currency }: {
  releases: Release[]
  formatPrice: (n: number) => string
  convertPrice: (amount: number, from: string, to: string) => number
  currency: string
}) {
  if (releases.length === 0) return null

  return (
    <section className="border-b border-zinc-900 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Featured</span>
          </div>
          <Link href="/explore" className="text-[10px] font-black text-zinc-600 hover:text-orange-500 uppercase tracking-widest transition-colors">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href={releaseUrl(releases[0])}
            className="sm:col-span-1 sm:row-span-2 group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
          >
            <Image src={coverSrc(releases[0])} fill className="object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" sizes="(min-width: 640px) 33vw, 100vw" alt={releases[0].title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{releases[0].type}</div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="font-black text-lg leading-tight">{releases[0].title}</p>
              <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{releases[0].artist_name}{releases[0].genre ? ` · ${releases[0].genre}` : ''}</p>
              <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(releases[0].price_pence / 100, 'GBP', currency))}</p>
            </div>
          </Link>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {releases.slice(1, 5).map(f => (
              <Link
                key={f.id}
                href={releaseUrl(f)}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
              >
                <Image src={coverSrc(f)} fill className="object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" sizes="(min-width: 640px) 25vw, 100vw" alt={f.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="font-black text-sm leading-tight">{f.title}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.artist_name}</p>
                  <p className="text-orange-600 font-black text-xs mt-1.5">{formatPrice(convertPrice(f.price_pence / 100, 'GBP', currency))}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomeClient({ releases, isLoggedIn, followedArtistReleases, activityItems, userEmail, popularSounds = [] }: HomeClientProps) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [currentGenre, setCurrentGenre] = useState('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [recentlyPlayed, setRecentlyPlayed] = useState<ReturnType<typeof getRecentlyPlayedReleases>>([])

  useEffect(() => {
    setRecentlyPlayed(getRecentlyPlayedReleases())
  }, [])

  const genres = useMemo(() => {
    const set = new Set<string>()
    releases.forEach(r => { if (r.genre) set.add(r.genre) })
    return ['All', ...Array.from(set).sort()]
  }, [releases])

  const filtered = useMemo(() => {
    if (currentGenre === 'All') return releases
    return releases.filter(r => r.genre === currentGenre)
  }, [releases, currentGenre])

  const visibleItems = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visibleCount

  const featured = useMemo(() => releases.slice(0, 5), [releases])

  const genreGroups = useMemo(() => {
    const groups: Record<string, Release[]> = {}
    releases.forEach(r => {
      if (r.genre) {
        if (!groups[r.genre]) groups[r.genre] = []
        groups[r.genre].push(r)
      }
    })
    return Object.entries(groups)
      .filter(([, items]) => items.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
  }, [releases])

  return (
    <div className="pb-40 font-display">

      {/* Sign-up banner for signed-out users */}
      {!isLoggedIn && (
        <section className="border-b border-zinc-900 bg-zinc-950">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-tight">
              Discover music. <span className="text-orange-500">Support artists directly.</span>
            </h1>
            <p className="text-zinc-400 text-sm md:text-base mt-2 max-w-lg">
              Buy music directly from independent artists. No subscriptions, no algorithms — just great music you own forever. 90% goes straight to the artist.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Link href="/auth?mode=signup" className="bg-orange-600 text-black font-black text-sm px-5 py-2.5 rounded-xl hover:bg-orange-500 transition-colors">
                Sign Up Free
              </Link>
              <Link href="/explore" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                Browse Music →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Recently played shelf (all users — localStorage-based) */}
      {recentlyPlayed.length > 0 && (
        <section className="border-b border-zinc-900">
          <Shelf title="Recently Played" subtitle="Pick up where you left off">
            {recentlyPlayed.map(r => (
              <ShelfCard
                key={r.releaseId}
                href={`/release?a=${r.artistSlug}&r=${r.releaseSlug}`}
                coverUrl={r.coverUrl || generateGradientDataUri(r.releaseId, r.releaseId)}
                title={r.releaseTitle}
                subtitle={r.artistName}
              />
            ))}
          </Shelf>
        </section>
      )}

      {/* New from artists you follow — horizontal shelf */}
      {isLoggedIn && followedArtistReleases.length > 0 && (
        <section className="border-b border-zinc-900">
          <Shelf title="New from artists you follow" pulse>
            {followedArtistReleases.slice(0, 12).map(r => (
              <ContextMenu key={r.id} items={releaseContextItems(r)} className="flex-shrink-0">
                <ShelfCard
                  href={releaseUrl(r)}
                  coverUrl={coverSrc(r)}
                  title={r.title}
                  subtitle={r.artist_name}
                  badge={r.isNew ? 'New' : undefined}
                  price={formatPrice(convertPrice(r.price_pence / 100, 'GBP', currency))}
                />
              </ContextMenu>
            ))}
          </Shelf>
        </section>
      )}

      {/* Social proof strip */}
      <SocialProofStrip items={activityItems} />

      {/* Featured hero */}
      <FeaturedHero releases={featured} formatPrice={formatPrice} convertPrice={convertPrice} currency={currency} />

      {/* Genre shelves — horizontal rows per genre */}
      {genreGroups.map(([genre, items]) => (
        <section key={genre} className="border-b border-zinc-900">
          <Shelf title={genre} seeAllHref={`/explore?tag=${encodeURIComponent(genre)}`}>
            {items.slice(0, 12).map(r => (
              <ContextMenu key={r.id} items={releaseContextItems(r)} className="flex-shrink-0">
                <ShelfCard
                  href={releaseUrl(r)}
                  coverUrl={coverSrc(r)}
                  title={r.title}
                  subtitle={r.artist_name}
                  price={formatPrice(convertPrice(r.price_pence / 100, 'GBP', currency))}
                />
              </ContextMenu>
            ))}
          </Shelf>
        </section>
      ))}

      {/* Sound tag discovery */}
      <section className="border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-1">Discover by sound</h2>
          <p className="text-xs text-zinc-600 mb-6">Dig into genres and sounds from across the platform</p>
          <div className="flex flex-wrap gap-2">
            {popularSounds.map(sound => (
              <Link
                key={sound}
                href={`/explore?tag=${encodeURIComponent(sound)}`}
                className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest bg-zinc-900 text-zinc-500 hover:text-white ring-1 ring-white/[0.06] transition-colors"
              >
                {sound}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Genre filter + all releases grid */}
      <section className="max-w-7xl mx-auto px-5 md:px-10 py-10">
        <div className="sticky-section-header py-4 -mx-5 md:-mx-10 px-5 md:px-10 mb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
              {currentGenre === 'All' ? 'All Releases' : currentGenre}
            </h2>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
              {filtered.length} release{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Genre pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 shelf-scroll">
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => { setCurrentGenre(genre); setVisibleCount(PAGE_SIZE) }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
                currentGenre === genre
                  ? 'bg-orange-600 text-black'
                  : 'bg-zinc-900 text-zinc-500 hover:text-white ring-1 ring-white/[0.06]'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        <ReleaseGrid releases={visibleItems} formatPrice={formatPrice} convertPrice={convertPrice} currency={currency} />

        {remaining > 0 && (
          <div className="text-center mt-10">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-full ring-1 ring-white/[0.06] transition-colors"
            >
              Load more ({remaining})
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-sm">No releases in this genre yet.</p>
          </div>
        )}
      </section>

      {/* Newsletter signup */}
      <NewsletterSignup isLoggedIn={isLoggedIn} userEmail={userEmail} />
    </div>
  )
}
