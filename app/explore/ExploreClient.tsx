'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { generateGradientDataUri } from '@/lib/gradient'
import { ContextMenu } from '@/app/components/ui/ContextMenu'
import { ReleaseCardSkeleton, ListItemSkeleton } from '@/app/components/ui/ReleaseSkeleton'
import { usePlayerStore } from '@/lib/stores/player'
import { AddToBasketButton } from '@/app/components/ui/AddToBasketButton'

/* ── Types ───────────────────────────────────────────────────── */

interface ExploreRelease {
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

interface ExploreClientProps {
  releases: ExploreRelease[]
  initialTag?: string | null
}

const PAGE_SIZE = 20

/* ── Icons (inline SVG helpers) ───────────────────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function releaseUrl(r: ExploreRelease) {
  return `/release?a=${r.artist_slug}&r=${r.slug}`
}

function coverSrc(r: ExploreRelease) {
  return r.cover_url || generateGradientDataUri(r.artist_id, r.id)
}

function priceGbp(r: ExploreRelease) {
  return r.price_pence / 100
}

/* ── Compact list with working play buttons ─────────────────── */

function CompactList({ items, formatPrice, convertPrice, currency }: {
  items: ExploreRelease[]
  formatPrice: (n: number) => string
  convertPrice: (amount: number, from: string, to: string) => number
  currency: string
}) {
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)

  return (
    <div className="flex flex-col gap-1">
      {items.map(r => {
        const active = currentTrack?.releaseId === r.id
        return (
          <ContextMenu key={r.id} items={[
            { label: 'Go to release', href: releaseUrl(r), icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg> },
            { label: 'Go to artist', href: `/${r.artist_slug}`, icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg> },
          ]}>
            <Link href={releaseUrl(r)} className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-zinc-900 transition-colors">
              <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                <Image src={coverSrc(r)} fill className="object-cover" sizes="40px" alt={r.title} />
              </div>
              <span className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0">{r.title}</span>
              <span className="hidden md:block text-[13px] text-zinc-500 truncate w-36 flex-shrink-0">{r.artist_name}</span>
              {r.genre && (
                <span className="hidden lg:inline-flex items-center bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0">
                  {r.genre}
                </span>
              )}
              <span className="flex-1" />
              <span className="text-[13px] font-semibold text-orange-600 flex-shrink-0">{formatPrice(convertPrice(priceGbp(r), 'GBP', currency))}</span>
              <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                {active && isPlaying ? (
                  <svg width="14" height="14" fill="#000" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                ) : (
                  <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                )}
              </div>
            </Link>
          </ContextMenu>
        )
      })}
    </div>
  )
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ExploreClient({ releases, initialTag }: ExploreClientProps) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [currentGenre, setCurrentGenre] = useState(initialTag || 'All')
  const [currentReleaseType, setCurrentReleaseType] = useState<'albums' | 'all'>('all')
  const [currentSort, setCurrentSort] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading] = useState(false)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  /* ── Derive genres + tags from real data ─────────────────────── */
  const genres = useMemo(() => {
    const set = new Set<string>()
    releases.forEach(r => {
      if (r.genre) set.add(r.genre)
      r.tags.forEach(t => set.add(t))
    })
    return ['All', ...Array.from(set).sort()]
  }, [releases])

  /* ── Genre counts ─────────────────────────────────────────── */
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { All: releases.length }
    genres.forEach(g => {
      if (g !== 'All') counts[g] = releases.filter(r => r.genre === g || r.tags.includes(g)).length
    })
    return counts
  }, [releases, genres])

  /* ── Featured = 5 newest releases ────────────────────────────── */
  const featured = useMemo(() => releases.slice(0, 5), [releases])

  /* ── Filtering & sorting ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let items = releases.filter(r => {
      const matchesGenre = currentGenre === 'All' || r.genre === currentGenre || r.tags.includes(currentGenre)
      const matchesType = currentReleaseType === 'all' || r.type === 'album' || r.type === 'ep'
      return matchesGenre && matchesType
    })
    if (currentSort === 'price-low') items = [...items].sort((a, b) => a.price_pence - b.price_pence)
    else if (currentSort === 'price-high') items = [...items].sort((a, b) => b.price_pence - a.price_pence)
    else if (currentSort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title))
    else {
      items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return items
  }, [releases, currentGenre, currentReleaseType, currentSort])

  const visibleItems = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visibleCount

  /* ── Actions ──────────────────────────────────────────────── */
  const setGenre = useCallback((genre: string) => {
    setCurrentGenre(genre)
    setVisibleCount(PAGE_SIZE)
  }, [])

  const headingText = currentGenre === 'All' ? 'All Releases' : currentGenre

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pb-40 font-display">

      {/* FEATURED HERO — hide when filtering by genre/tag */}
      {featured.length > 0 && currentGenre === 'All' && (
        <section className="border-b border-zinc-900 bg-zinc-950">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">New Releases</h2>
              </div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden sm:block">Latest from the community</span>
            </div>
            {featured.length >= 3 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Large featured */}
                <Link
                  href={releaseUrl(featured[0])}
                  className="sm:col-span-1 sm:row-span-2 group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
                >
                  <Image src={coverSrc(featured[0])} fill className="object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500" sizes="(min-width: 640px) 33vw, 100vw" alt="Album artwork" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{featured[0].type}</div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="font-black text-lg leading-tight">{featured[0].title}</p>
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{featured[0].artist_name}{featured[0].genre ? ` · ${featured[0].genre}` : ''}</p>
                    <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(priceGbp(featured[0]), 'GBP', currency))}</p>
                  </div>
                </Link>
                {/* Smaller featured */}
                <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                  {featured.slice(1).map(f => (
                    <Link
                      key={f.id}
                      href={releaseUrl(f)}
                      className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
                    >
                      <Image src={coverSrc(f)} fill className="object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500" sizes="(min-width: 640px) 25vw, 50vw" alt="Album artwork" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="font-black text-sm leading-tight">{f.title}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.artist_name}</p>
                        <p className="text-orange-600 font-black text-xs mt-1.5">{formatPrice(convertPrice(priceGbp(f), 'GBP', currency))}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`grid gap-4 ${featured.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {featured.map(f => (
                  <Link
                    key={f.id}
                    href={releaseUrl(f)}
                    className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
                  >
                    <Image src={coverSrc(f)} fill className="object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500" sizes="(min-width: 640px) 50vw, 100vw" alt="Album artwork" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{f.type}</div>
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="font-black text-lg leading-tight">{f.title}</p>
                      <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{f.artist_name}{f.genre ? ` · ${f.genre}` : ''}</p>
                      <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(priceGbp(f), 'GBP', currency))}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* BROWSE ALL */}
      <main className="max-w-7xl mx-auto px-5 md:px-10 py-8">
        {/* Filters + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 min-w-0">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
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
                  {g} <span className="opacity-60 ml-1">{genreCounts[g]}</span>
                </button>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none sm:hidden" />
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center">
            <select
              value={currentReleaseType}
              onChange={e => { setCurrentReleaseType(e.target.value as 'albums' | 'all'); setVisibleCount(PAGE_SIZE) }}
              className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4 text-xs font-bold text-zinc-400 outline-none focus:border-orange-600 transition-colors cursor-pointer"
            >
              <option value="all">All releases</option>
              <option value="albums">Albums &amp; EPs</option>
            </select>
            <select
              value={currentSort}
              onChange={e => { setCurrentSort(e.target.value); setVisibleCount(PAGE_SIZE) }}
              className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4 text-xs font-bold text-zinc-400 outline-none focus:border-orange-600 transition-colors cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low &rarr; High</option>
              <option value="price-high">Price: High &rarr; Low</option>
              <option value="az">A &rarr; Z</option>
            </select>
            <ViewToggle mode={viewMode} onToggle={setViewMode} />
          </div>
        </div>

        {/* Results header — sticky */}
        <div className="sticky-section-header py-3 -mx-5 md:-mx-10 px-5 md:px-10 mb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">{headingText}</h2>
            {!loading && filtered.length > 0 && (
              <p className="text-xs text-zinc-600 font-bold">Showing {visibleItems.length} of {filtered.length}</p>
            )}
          </div>
        </div>

        {/* Skeleton loader */}
        {loading && viewMode === 'expanded' && <ReleaseCardSkeleton />}
        {loading && viewMode === 'compact' && <ListItemSkeleton />}

        {/* Grid view */}
        {!loading && filtered.length > 0 && viewMode === 'expanded' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {visibleItems.map(r => (
              <ContextMenu key={r.id} items={[
                { label: 'Go to release', href: releaseUrl(r), icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg> },
                { label: 'Go to artist', href: `/${r.artist_slug}`, icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg> },
                { divider: true, label: '' },
                { label: 'Share', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>, onClick: () => { navigator.clipboard?.writeText(`${window.location.origin}${releaseUrl(r)}`).catch(() => {}) } },
              ]}>
                <div className="group cursor-pointer">
                  <Link href={releaseUrl(r)}>
                    <div className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 group-hover:border-zinc-700 transition-all mb-3 relative bg-zinc-900">
                      <Image src={coverSrc(r)} fill className="object-cover opacity-90 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" alt={r.title} />
                      {r.isNew && (
                        <span className="absolute top-2 left-2 bg-orange-600 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider z-10">New</span>
                      )}
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 sm:transition-opacity">
                        <AddToBasketButton
                          item={{
                            type: 'release',
                            releaseId: r.id,
                            releaseTitle: r.title,
                            releaseSlug: r.slug,
                            artistId: r.artist_id,
                            artistName: r.artist_name,
                            artistSlug: r.artist_slug,
                            coverUrl: r.cover_url,
                            pricePence: r.price_pence,
                            currency: 'GBP',
                            accentColour: r.accent_colour,
                          }}
                          size={18}
                        />
                      </div>
                    </div>
                  </Link>
                  <Link href={releaseUrl(r)}>
                    <h3 className="font-bold text-sm truncate">{r.title}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate mt-0.5">{r.artist_name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      {r.genre && <span className="text-[10px] text-zinc-700 font-bold">{r.genre}</span>}
                      <span className="text-xs font-black text-orange-600 ml-auto">{formatPrice(convertPrice(priceGbp(r), 'GBP', currency))}</span>
                    </div>
                  </Link>
                </div>
              </ContextMenu>
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && filtered.length > 0 && viewMode === 'compact' && (
          <CompactList items={visibleItems} formatPrice={formatPrice} convertPrice={convertPrice} currency={currency} />
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-5">
              <SearchIcon className="text-zinc-600" />
            </div>
            {releases.length === 0 ? (
              <>
                <p className="font-black text-zinc-400 text-lg mb-2">No releases yet</p>
                <p className="text-sm text-zinc-600 mb-5">Be the first artist to publish on Insound</p>
              </>
            ) : (
              <>
                <p className="font-black text-zinc-400 text-lg mb-2">No results found</p>
                <p className="text-sm text-zinc-600 mb-5">Try a different genre or filter</p>
                <button
                  onClick={() => setGenre('All')}
                  className="text-xs font-black text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}

        {/* Load More */}
        {!loading && remaining > 0 && (
          <div className="text-center mt-10">
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="bg-zinc-900 border border-zinc-800 text-white font-black px-10 py-4 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm uppercase tracking-wider"
            >
              Load More
            </button>
            <p className="text-xs text-zinc-600 font-bold mt-3">{remaining} more release{remaining !== 1 ? 's' : ''}</p>
          </div>
        )}
      </main>

      {/* REGISTER INTEREST */}
      <section className="py-24 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/20 rounded-full px-4 py-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Now Live</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">Start selling today.</h2>
          <p className="text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">Upload your music, set your price, and get paid directly. You keep 90% &mdash; we absorb all processing fees. No monthly fee, no approval process.</p>
          <Link href="/auth?mode=signup&intent=artist"
            className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-7 py-4 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20 mb-5">
            Get started &rarr;
          </Link>
          <p className="text-zinc-600 text-xs font-medium">
            Free to join &nbsp;&middot;&nbsp; No credit card required &nbsp;&middot;&nbsp;{' '}
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </section>

    </div>
  )
}
