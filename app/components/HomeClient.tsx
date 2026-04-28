'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useCurrency } from '../providers/CurrencyProvider'
import { generateGradientDataUri } from '@/lib/gradient'
import { SocialProofStrip, type ActivityItem } from './ui/SocialProofStrip'
import { NewsletterSignup } from './ui/NewsletterSignup'
import { SOUNDS } from '@/lib/sounds'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'

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
}

const PAGE_SIZE = 20

function releaseUrl(r: Release) {
  return `/release?a=${r.artist_slug}&r=${r.slug}`
}

function coverSrc(r: Release) {
  return r.cover_url || generateGradientDataUri(r.artist_id, r.id)
}

function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className="ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function usePlayRelease() {
  const play = usePlayerStore(s => s.play)
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const pause = usePlayerStore(s => s.pause)
  const resume = usePlayerStore(s => s.resume)

  return useCallback(async (e: React.MouseEvent, r: Release) => {
    e.preventDefault()
    e.stopPropagation()

    if (currentTrack?.releaseId === r.id) {
      isPlaying ? pause() : resume()
      return
    }

    const res = await fetch(`/api/releases/tracks?releaseId=${r.id}`)
    if (!res.ok) return
    const tracks = await res.json()
    if (!tracks.length) return

    const queue: PlayerTrack[] = tracks.map((t: { id: string; title: string; position: number; duration_sec: number | null }) => ({
      id: t.id,
      title: t.title,
      artistName: r.artist_name,
      artistSlug: r.artist_slug,
      releaseId: r.id,
      releaseTitle: r.title,
      coverUrl: r.cover_url,
      position: t.position,
      durationSec: t.duration_sec,
      accentColour: r.accent_colour,
      purchased: false,
    }))
    play(queue[0], queue)
  }, [play, currentTrack, isPlaying, pause, resume])
}

function ReleaseGrid({ releases, formatPrice, convertPrice, currency }: {
  releases: Release[]
  formatPrice: (n: number) => string
  convertPrice: (amount: number, from: string, to: string) => number
  currency: string
}) {
  const playRelease = usePlayRelease()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
      {releases.map(r => (
        <Link key={r.id} href={releaseUrl(r)} className="group">
          <div className="aspect-square rounded-2xl overflow-hidden mb-3 ring-1 ring-white/[0.06] relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc(r)}
              alt={`${r.title} by ${r.artist_name}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {r.isNew && (
              <span className="absolute top-2 left-2 bg-orange-600 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                New
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => playRelease(e, r)}>
              <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-full flex items-center justify-center border border-white/30">
                <PlayIcon size={18} />
              </div>
            </div>
          </div>
          <p className="font-display font-bold text-sm text-white truncate">{r.title}</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{r.artist_name}</p>
          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {r.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-800/60 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <span className="inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 rounded-full">
            {formatPrice(convertPrice(r.price_pence / 100, 'GBP', currency))}
          </span>
        </Link>
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
  const playRelease = usePlayRelease()
  if (releases.length < 3) return null

  return (
    <section className="border-b border-zinc-900 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Just Added</span>
          </div>
          <Link href="/explore" className="text-[10px] font-black text-zinc-600 hover:text-orange-500 uppercase tracking-widest transition-colors">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href={releaseUrl(releases[0])}
            className="sm:col-span-1 group relative rounded-2xl overflow-hidden aspect-square sm:aspect-auto sm:h-56 bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverSrc(releases[0])} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{releases[0].type}</div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="font-black text-lg leading-tight">{releases[0].title}</p>
              <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{releases[0].artist_name}{releases[0].genre ? ` · ${releases[0].genre}` : ''}</p>
              <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(releases[0].price_pence / 100, 'GBP', currency))}</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => playRelease(e, releases[0])}>
              <div className="bg-orange-600 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl">
                <PlayIcon size={22} />
              </div>
            </div>
          </Link>
          <div className="sm:col-span-2 grid grid-cols-2 gap-4">
            {releases.slice(1, 5).map(f => (
              <Link
                key={f.id}
                href={releaseUrl(f)}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverSrc(f)} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="font-black text-sm leading-tight">{f.title}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.artist_name}</p>
                  <p className="text-orange-600 font-black text-xs mt-1.5">{formatPrice(convertPrice(f.price_pence / 100, 'GBP', currency))}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => playRelease(e, f)}>
                  <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-full flex items-center justify-center border border-white/30">
                    <PlayIcon size={18} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomeClient({ releases, isLoggedIn, followedArtistReleases, activityItems, userEmail }: HomeClientProps) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [currentGenre, setCurrentGenre] = useState('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

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

  return (
    <div className="pb-24 font-display">

      {/* Sign-up banner for signed-out users */}
      {!isLoggedIn && (
        <section className="border-b border-zinc-900 bg-zinc-950">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-tight">
              Music that <span className="text-orange-500">pays artists.</span>
            </h1>
            <p className="text-zinc-400 text-sm md:text-base mt-2 max-w-lg">
              A home for independent artists to sell music directly to fans. No monthly fee. No label required. No approval process. Just upload, set your price, and start selling.
            </p>
          </div>
        </section>
      )}

      {/* New from artists you follow (signed-in only) */}
      {isLoggedIn && followedArtistReleases.length > 0 && (
        <section className="border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">New from artists you follow</h2>
            </div>
            <ReleaseGrid
              releases={followedArtistReleases.slice(0, 10)}
              formatPrice={formatPrice}
              convertPrice={convertPrice}
              currency={currency}
            />
          </div>
        </section>
      )}

      {/* Social proof strip */}
      <SocialProofStrip items={activityItems} />

      {/* Featured hero */}
      <FeaturedHero releases={featured} formatPrice={formatPrice} convertPrice={convertPrice} currency={currency} />

      {/* Sound tag discovery */}
      <section className="border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-1">Discover by sound</h2>
          <p className="text-xs text-zinc-600 mb-6">Dig into genres and sounds from across the platform</p>
          <div className="flex flex-wrap gap-2">
            {SOUNDS.filter(sound => releases.some(r => r.genre === sound || r.tags.includes(sound))).map(sound => (
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
            {currentGenre === 'All' ? 'All Releases' : currentGenre}
          </h2>
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            {filtered.length} release{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Genre pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
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
