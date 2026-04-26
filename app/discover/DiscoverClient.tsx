'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useCurrency } from '../providers/CurrencyProvider'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { Badge } from '@/app/components/ui/Badge'
import { FavouriteButton } from '@/app/components/ui/FavouriteButton'

/* ── Types ───────────────────────────────────────────────────── */

interface Artist {
  id: string
  slug: string
  name: string
  avatar_url: string | null
  accent_colour: string | null
}

interface Release {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  genre: string | null
  price_pence: number
  created_at?: string
  artists: Artist | Artist[]
  release_tags?: { tag: string }[]
}

interface Featured {
  id: string
  week_of: string
  editorial_note: string | null
  artists: Artist | Artist[]
  releases?: { releases: Omit<Release, 'artists'>[] }
}

interface Recommendation {
  id: string
  recommender_id: string
  recommended_id: string
  recommender: Artist | Artist[]
  recommended: Artist | Artist[]
}

interface Props {
  featured: Featured | null
  newReleases: Release[]
  recommendations: Recommendation[]
  fanGenres: string[]
  isLoggedIn: boolean
  artistBadges?: Record<string, { badge_type: string; metadata?: { position?: number } | null }>
}

const PAGE_SIZE = 12

/* ── SVG Icons ───────────────────────────────────────────────── */

function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className="ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-zinc-600">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function getArtist(a: Artist | Artist[]): Artist {
  return Array.isArray(a) ? a[0] : a
}

function getTags(r: Release): string[] {
  return r.release_tags?.map(t => t.tag) ?? (r.genre ? [r.genre] : [])
}

function getAllSounds(releases: Release[]): string[] {
  const set = new Set<string>()
  releases.forEach(r => getTags(r).forEach(t => set.add(t)))
  return Array.from(set).sort()
}

/* ── Main Component ──────────────────────────────────────────── */

interface TrackItem {
  id: string
  title: string
  position: number
  duration_sec: number | null
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function DiscoverClient({ featured, newReleases, recommendations, fanGenres, isLoggedIn, artistBadges = {} }: Props) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const { mode: viewMode, set: setViewMode } = useViewMode()
  const [currentGenre, setCurrentGenre] = useState('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())
  const [trackCache, setTrackCache] = useState<Record<string, TrackItem[]>>({})
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback(async (releaseId: string) => {
    setExpandedReleases(prev => {
      const next = new Set(prev)
      if (next.has(releaseId)) {
        next.delete(releaseId)
      } else {
        next.add(releaseId)
      }
      return next
    })

    if (!trackCache[releaseId] && !loadingTracks.has(releaseId)) {
      setLoadingTracks(prev => new Set(prev).add(releaseId))
      try {
        const res = await fetch(`/api/releases/tracks?releaseId=${releaseId}`)
        if (res.ok) {
          const tracks: TrackItem[] = await res.json()
          setTrackCache(prev => ({ ...prev, [releaseId]: tracks }))
        }
      } finally {
        setLoadingTracks(prev => {
          const next = new Set(prev)
          next.delete(releaseId)
          return next
        })
      }
    }
  }, [trackCache, loadingTracks])

  const genres = useMemo(() => getAllSounds(newReleases), [newReleases])

  const filteredReleases = useMemo(() => {
    let items = newReleases
    if (currentGenre !== 'All') {
      items = items.filter(r => getTags(r).includes(currentGenre))
    }
    if (fanGenres.length > 0 && currentGenre === 'All') {
      const preferred = items.filter(r => getTags(r).some(t => fanGenres.includes(t)))
      const rest = items.filter(r => !getTags(r).some(t => fanGenres.includes(t)))
      items = [...preferred, ...rest]
    }
    return items
  }, [newReleases, currentGenre, fanGenres])

  const visibleReleases = filteredReleases.slice(0, visibleCount)
  const remaining = filteredReleases.length - visibleCount

  const setGenre = useCallback((genre: string) => {
    setCurrentGenre(genre)
    setVisibleCount(PAGE_SIZE)
  }, [])

  const price = (pence: number) => formatPrice(convertPrice(pence / 100, 'GBP', currency))

  const featuredArtist = featured ? getArtist(featured.artists) : null

  const chains = useMemo(() => {
    const map = new Map<string, { recommender: Artist; recommended: Artist[] }>()
    for (const rec of recommendations) {
      const from = getArtist(rec.recommender)
      const to = getArtist(rec.recommended)
      const existing = map.get(from.id)
      if (existing) {
        existing.recommended.push(to)
      } else {
        map.set(from.id, { recommender: from, recommended: [to] })
      }
    }
    return Array.from(map.values())
  }, [recommendations])

  return (
    <div className="min-h-screen font-display">
      {/* ── SECTION 1: INSOUND SELECTS ────────────────────────── */}
      {featuredArtist && featured && (
        <section className="relative overflow-hidden border-b border-zinc-900">
          {/* Background */}
          <div className="absolute inset-0">
            {featuredArtist.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featuredArtist.avatar_url}
                alt=""
                role="presentation"
                className="w-full h-full object-cover opacity-20 blur-2xl scale-110"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/60 via-[#0A0A0A]/80 to-[#0A0A0A]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 md:px-10 py-16 md:py-24">
            <div className="flex items-center gap-2.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                Insound Selects
              </h2>
            </div>

            <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">
              {/* Artist image */}
              <div className="w-full md:w-80 flex-shrink-0">
                <div className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  {featuredArtist.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featuredArtist.avatar_url}
                      alt={featuredArtist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-6xl font-black text-zinc-700"
                      style={{ background: featuredArtist.accent_colour ?? '#18181b' }}
                    >
                      {featuredArtist.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3">
                  {featuredArtist.name}
                </h1>

                {featured.editorial_note && (
                  <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mb-8">
                    {featured.editorial_note}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/${featuredArtist.slug}`}
                    className="inline-flex items-center gap-2 bg-orange-600 text-black font-black px-8 py-4 rounded-full text-sm hover:bg-orange-500 transition-colors"
                  >
                    <PlayIcon size={18} />
                    Play
                  </Link>
                  <Link
                    href={`/${featuredArtist.slug}`}
                    className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-white font-black px-8 py-4 rounded-full text-sm hover:border-zinc-600 transition-colors"
                  >
                    View Artist
                    <ArrowIcon />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty state for no featured artist */}
      {!featured && (
        <section className="border-b border-zinc-900 py-20">
          <div className="max-w-7xl mx-auto px-5 md:px-10 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-zinc-700" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Insound Selects
              </h2>
            </div>
            <p className="text-zinc-600 text-sm">No featured artist this week. Check back soon.</p>
          </div>
        </section>
      )}

      {/* ── SECTION 2: NEW THIS WEEK ──────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-orange-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
                New This Week
              </h2>
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden sm:block">
              Albums &amp; EPs first
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div
              className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              <button
                onClick={() => setGenre('All')}
                className={`px-4 py-2 rounded-full font-bold text-xs flex-shrink-0 transition-all ${
                  currentGenre === 'All'
                    ? 'bg-orange-600 text-black'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`px-4 py-2 rounded-full font-bold text-xs flex-shrink-0 transition-all ${
                    currentGenre === g
                      ? 'bg-orange-600 text-black'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex-shrink-0">
              <ViewToggle mode={viewMode} onToggle={setViewMode} />
            </div>
          </div>

          {/* Results count */}
          {filteredReleases.length > 0 && (
            <p className="text-xs text-zinc-600 font-bold mb-5">
              Showing {visibleReleases.length} of {filteredReleases.length}
            </p>
          )}

          {/* Grid view */}
          {filteredReleases.length > 0 && viewMode === 'expanded' && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {visibleReleases.map(r => {
                const artist = getArtist(r.artists as Artist | Artist[])
                return (
                  <div key={r.id} className="group cursor-pointer">
                    <Link href={`/${artist.slug}/${r.slug}`}>
                      <div className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 group-hover:border-zinc-700 transition-all mb-3 relative bg-zinc-900">
                        {r.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.cover_url}
                            className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105"
                            loading="lazy"
                            alt={r.title}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-700">
                            {r.title.charAt(0)}
                          </div>
                        )}
                        <span className="absolute top-2 left-2 bg-orange-600/90 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {r.type}
                        </span>
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-orange-600 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl">
                            <PlayIcon size={18} />
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between">
                      <Link href={`/${artist.slug}/${r.slug}`} className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm truncate">{r.title}</h3>
                      </Link>
                      <FavouriteButton releaseId={r.id} size={16} />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">
                        {artist.name}
                      </p>
                      {artistBadges[artist.id] && <Badge type={artistBadges[artist.id].badge_type} position={artistBadges[artist.id].metadata?.position} size="xs" />}
                    </div>
                    {getTags(r).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTags(r).map(tag => (
                          <span key={tag} className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-black text-orange-600 ml-auto">
                        {price(r.price_pence)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Compact/list view */}
          {filteredReleases.length > 0 && viewMode === 'compact' && (
            <div className="flex flex-col gap-1">
              {visibleReleases.map(r => {
                const artist = getArtist(r.artists as Artist | Artist[])
                const isMultiTrack = r.type === 'album' || r.type === 'ep'
                const isExpanded = expandedReleases.has(r.id)
                const tracks = trackCache[r.id]
                const isLoading = loadingTracks.has(r.id)
                return (
                  <div key={r.id} className="rounded-xl">
                    <div className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                      {isMultiTrack && (
                        <button
                          onClick={() => toggleExpanded(r.id)}
                          className="w-5 h-5 flex items-center justify-center shrink-0 text-zinc-500 hover:text-white transition-colors"
                          aria-label={isExpanded ? 'Collapse tracks' : 'Expand tracks'}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}
                          >
                            <line x1="7" y1="2" x2="7" y2="12" />
                            <line x1="2" y1="7" x2="12" y2="7" />
                          </svg>
                        </button>
                      )}
                      <Link href={`/${artist.slug}/${r.slug}`} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                        {r.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.cover_url} className="w-full h-full object-cover" loading="lazy" alt={r.title} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-black text-zinc-700">
                            {r.title.charAt(0)}
                          </div>
                        )}
                      </Link>
                      <Link href={`/${artist.slug}/${r.slug}`} className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0 hover:text-orange-500 transition-colors">
                        {r.title}
                      </Link>
                      <span className="hidden md:flex items-center gap-1 text-[13px] text-zinc-500 truncate w-36 flex-shrink-0">
                        {artist.name}
                        {artistBadges[artist.id] && <Badge type={artistBadges[artist.id].badge_type} position={artistBadges[artist.id].metadata?.position} size="xs" />}
                      </span>
                      <span className="hidden lg:inline-flex items-center bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0">
                        {r.type}
                      </span>
                      {getTags(r).length > 0 && (
                        <span className="hidden lg:flex gap-1 flex-shrink-0">
                          {getTags(r).map(tag => (
                            <span key={tag} className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="flex-1" />
                      <span className="text-[13px] font-semibold text-orange-600 flex-shrink-0">
                        {price(r.price_pence)}
                      </span>
                      <FavouriteButton releaseId={r.id} size={16} />
                      <Link
                        href={`/${artist.slug}/${r.slug}`}
                        className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shrink-0 hover:bg-orange-500 transition-colors"
                      >
                        <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </Link>
                    </div>

                    {isMultiTrack && (
                      <div
                        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
                        style={{ maxHeight: isExpanded ? `${(tracks?.length ?? 3) * 40 + 8}px` : '0px' }}
                      >
                        <div className="pl-11 md:pl-12 pr-3 pb-2">
                          {isLoading && !tracks && (
                            <div className="flex items-center gap-2 h-10 px-3">
                              <span className="text-[11px] text-zinc-600">Loading tracks…</span>
                            </div>
                          )}
                          {tracks?.map(track => (
                            <div
                              key={track.id}
                              className="flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-[#181818] transition-colors"
                            >
                              <span className="text-[11px] text-zinc-600 font-bold w-5 text-right shrink-0">
                                {track.position}
                              </span>
                              <span className="text-[13px] text-zinc-300 truncate min-w-0 flex-1">
                                {track.title}
                              </span>
                              <span className="text-[11px] text-zinc-600 font-medium shrink-0">
                                {formatDuration(track.duration_sec)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {filteredReleases.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-5">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-600">
                  <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z" />
                </svg>
              </div>
              <p className="font-black text-zinc-400 text-lg mb-2">No new releases this week</p>
              <p className="text-sm text-zinc-600 mb-5">
                {currentGenre !== 'All' ? 'Try a different sound filter' : 'Check back soon for fresh music'}
              </p>
              {currentGenre !== 'All' && (
                <button
                  onClick={() => setGenre('All')}
                  className="text-xs font-black text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Load more */}
          {remaining > 0 && (
            <div className="text-center mt-10">
              <button
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="bg-zinc-900 border border-zinc-800 text-white font-black px-10 py-4 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm uppercase tracking-wider"
              >
                Load More
              </button>
              <p className="text-xs text-zinc-600 font-bold mt-3">
                {remaining} more release{remaining !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 3: ARTISTS RECOMMENDING ARTISTS ───────────── */}
      {chains.length > 0 && (
        <section className="py-12 md:py-16 border-t border-zinc-900">
          <div className="max-w-7xl mx-auto px-5 md:px-10">
            <div className="flex items-center gap-2.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-orange-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
                Artists Recommending Artists
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chains.map(chain => (
                <div
                  key={chain.recommender.id}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors"
                >
                  {/* Recommender */}
                  <Link
                    href={`/${chain.recommender.slug}`}
                    className="flex items-center gap-3 mb-4 group"
                  >
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 bg-zinc-800"
                      style={{ borderColor: chain.recommender.accent_colour ?? '#F56D00' }}
                    >
                      {chain.recommender.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={chain.recommender.avatar_url}
                          alt={chain.recommender.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-black text-zinc-600">
                          {chain.recommender.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate group-hover:text-orange-500 transition-colors">
                        {chain.recommender.name}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                        Recommends
                      </p>
                    </div>
                  </Link>

                  {/* Recommended chain */}
                  <div className="space-y-2 pl-3 border-l-2 border-zinc-800 ml-5">
                    {chain.recommended.map(rec => (
                      <Link
                        key={rec.id}
                        href={`/${rec.slug}`}
                        className="flex items-center gap-3 py-2 group/rec hover:bg-white/[0.02] rounded-lg px-2 -ml-2 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                          {rec.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={rec.avatar_url} alt={rec.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-zinc-600">
                              {rec.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-bold text-zinc-300 truncate group-hover/rec:text-white transition-colors">
                          {rec.name}
                        </span>
                        <span className="ml-auto flex-shrink-0">
                          <ChevronRight />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
