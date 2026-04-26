'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { generateGradientDataUri } from '@/lib/gradient'

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
function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className="ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
function CheckIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="#F56D00" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function releaseUrl(r: ExploreRelease) {
  return `/${r.artist_slug}/${r.slug}`
}

function coverSrc(r: ExploreRelease) {
  return r.cover_url || generateGradientDataUri(r.artist_id, r.id)
}

function priceGbp(r: ExploreRelease) {
  return r.price_pence / 100
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ExploreClient({ releases }: ExploreClientProps) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [currentGenre, setCurrentGenre] = useState('All')
  const [currentReleaseType, setCurrentReleaseType] = useState<'albums' | 'all'>('albums')
  const [currentSort, setCurrentSort] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  // Register interest state
  const [registered, setRegistered] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stickyDismissed, setStickyDismissed] = useState(false)
  const registerEmailRef = useRef<HTMLInputElement>(null)
  const stickyEmailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('insound_interested')) setRegistered(true)
      if (sessionStorage.getItem('insound_bar_dismissed')) setStickyDismissed(true)
    }
  }, [])

  useEffect(() => {
    if (registered || stickyDismissed) return
    const handler = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1)
      if (pct > 0.35) setStickyVisible(true)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [registered, stickyDismissed])

  /* ── Derive genres from real data ────────────────────────────── */
  const genres = useMemo(() => {
    const set = new Set<string>()
    releases.forEach(r => { if (r.genre) set.add(r.genre) })
    return ['All', ...Array.from(set).sort()]
  }, [releases])

  /* ── Genre counts ─────────────────────────────────────────── */
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { All: releases.length }
    genres.forEach(g => {
      if (g !== 'All') counts[g] = releases.filter(r => r.genre === g).length
    })
    return counts
  }, [releases, genres])

  /* ── Featured = 5 newest releases ────────────────────────────── */
  const featured = useMemo(() => releases.slice(0, 5), [releases])

  /* ── Filtering & sorting ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let items = releases.filter(r => {
      const matchesGenre = currentGenre === 'All' || r.genre === currentGenre
      const matchesType = currentReleaseType === 'all' || r.type === 'album' || r.type === 'ep'
      return matchesGenre && matchesType
    })
    if (currentSort === 'price-low') items = [...items].sort((a, b) => a.price_pence - b.price_pence)
    else if (currentSort === 'price-high') items = [...items].sort((a, b) => b.price_pence - a.price_pence)
    else if (currentSort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title))
    else {
      const typeOrder: Record<string, number> = { album: 0, ep: 1, single: 2 }
      items = [...items].sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2))
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

  /* ── Register interest ────────────────────────────────────── */
  const submitInterest = useCallback(async (email: string, inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      if (inputRef.current) {
        inputRef.current.style.borderColor = '#ef4444'
        inputRef.current.focus()
      }
      return
    }
    try {
      const res = await fetch('https://formspree.io/f/mbjergwz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: 'Explore | insound.' }),
      })
      if (res.ok) {
        localStorage.setItem('insound_interested', '1')
        setRegistered(true)
        setStickyDismissed(true)
        sessionStorage.setItem('insound_bar_dismissed', '1')
      } else if (inputRef.current) {
        inputRef.current.style.borderColor = '#ef4444'
      }
    } catch {
      if (inputRef.current) inputRef.current.style.borderColor = '#ef4444'
    }
  }, [])

  const dismissStickyBar = useCallback(() => {
    setStickyDismissed(true)
    setStickyVisible(false)
    sessionStorage.setItem('insound_bar_dismissed', '1')
  }, [])

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pb-24 font-display">

      {/* FEATURED HERO */}
      {featured.length > 0 && (
        <section className="border-b border-zinc-900 bg-zinc-950">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">New Releases</h2>
              </div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden sm:block">Latest from the community</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Large featured */}
              <Link
                href={releaseUrl(featured[0])}
                className="sm:col-span-1 group relative rounded-2xl overflow-hidden aspect-square sm:aspect-auto sm:h-56 bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverSrc(featured[0])} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="Album artwork" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{featured[0].type}</div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-black text-lg leading-tight">{featured[0].title}</p>
                  <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{featured[0].artist_name}{featured[0].genre ? ` · ${featured[0].genre}` : ''}</p>
                  <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(priceGbp(featured[0]), 'GBP', currency))}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-orange-600 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl">
                    <PlayIcon size={22} />
                  </div>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverSrc(f)} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="Album artwork" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="font-black text-sm leading-tight">{f.title}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.artist_name}</p>
                      <p className="text-orange-600 font-black text-xs mt-1.5">{formatPrice(convertPrice(priceGbp(f), 'GBP', currency))}</p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
      )}

      {/* BROWSE ALL */}
      <main className="max-w-7xl mx-auto px-5 md:px-10 py-8">
        {/* Filters + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
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
          <div className="flex gap-2 flex-shrink-0 items-center">
            <select
              value={currentReleaseType}
              onChange={e => { setCurrentReleaseType(e.target.value as 'albums' | 'all'); setVisibleCount(PAGE_SIZE) }}
              className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4 text-xs font-bold text-zinc-400 outline-none focus:border-orange-600 transition-colors cursor-pointer"
            >
              <option value="albums">Albums &amp; EPs</option>
              <option value="all">All releases</option>
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

        {/* Results header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">{headingText}</h2>
          {!loading && filtered.length > 0 && (
            <p className="text-xs text-zinc-600 font-bold">Showing {visibleItems.length} of {filtered.length}</p>
          )}
        </div>

        {/* Skeleton loader */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`space-y-2 ${i >= 2 && i < 4 ? 'hidden md:block' : ''} ${i === 4 ? 'hidden lg:block' : ''}`}>
                <div className="aspect-square rounded-2xl" style={{ background: 'linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                <div className="h-3 w-3/4 rounded-2xl" style={{ background: 'linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                <div className="h-2 w-1/2 rounded-2xl" style={{ background: 'linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              </div>
            ))}
          </div>
        )}

        {/* Grid view */}
        {!loading && filtered.length > 0 && viewMode === 'expanded' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {visibleItems.map(r => (
              <div key={r.id} className="group cursor-pointer">
                <Link href={releaseUrl(r)}>
                  <div className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 group-hover:border-zinc-700 transition-all mb-3 relative bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverSrc(r)} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105" loading="lazy" alt={r.title} />
                    {r.isNew && (
                      <span className="absolute top-2 left-2 bg-orange-600 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider z-10">New</span>
                    )}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-orange-600 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl">
                        <PlayIcon size={18} />
                      </div>
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
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && filtered.length > 0 && viewMode === 'compact' && (
          <div className="flex flex-col gap-1">
            {visibleItems.map(r => (
              <Link key={r.id} href={releaseUrl(r)} className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverSrc(r)} className="w-full h-full object-cover" loading="lazy" alt={r.title} />
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
                <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shrink-0 hover:bg-orange-500 transition-colors">
                  <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
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
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Early Access Open</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">Be first in line.</h2>
          <p className="text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">Register your interest and get priority access, a founding member badge, and your rate locked in forever &mdash; before we open to everyone.</p>
          {!registered ? (
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5">
              <input
                ref={registerEmailRef}
                type="email"
                placeholder="your@email.com"
                onKeyDown={e => { if (e.key === 'Enter') submitInterest(registerEmailRef.current?.value.trim() ?? '', registerEmailRef) }}
                className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-orange-600 focus:outline-none rounded-xl px-4 py-4 text-sm font-medium text-white placeholder-zinc-600 transition-colors"
              />
              <button
                onClick={() => submitInterest(registerEmailRef.current?.value.trim() ?? '', registerEmailRef)}
                className="bg-orange-600 hover:bg-orange-500 text-black font-black px-7 py-4 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20"
              >
                Register &rarr;
              </button>
            </div>
          ) : (
            <div className="mb-5">
              <div className="inline-flex items-center gap-3 bg-orange-600/10 border border-orange-600/20 rounded-xl px-6 py-4">
                <CheckIcon size={16} />
                <span className="text-orange-500 font-black text-sm">{"You're on the list. We'll be in touch."}</span>
              </div>
            </div>
          )}
          <p className="text-zinc-600 text-xs font-medium">
            No spam, ever &nbsp;&middot;&nbsp; Unsubscribe anytime &nbsp;&middot;&nbsp;{' '}
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </section>

      {/* STICKY REGISTER BAR */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-5 py-3.5"
        style={{
          transform: stickyVisible && !stickyDismissed && !registered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <div className="hidden sm:block flex-1 min-w-0">
            <p className="font-black text-sm text-white">Get early access to Insound</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Founding member rates &mdash; locked forever</p>
          </div>
          <div className="flex gap-2 flex-1 sm:flex-initial">
            <input
              ref={stickyEmailRef}
              type="email"
              placeholder="your@email.com"
              onKeyDown={e => { if (e.key === 'Enter') submitInterest(stickyEmailRef.current?.value.trim() ?? '', stickyEmailRef) }}
              className="flex-1 sm:w-52 bg-zinc-800 border border-zinc-700 focus:border-orange-600 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors"
            />
            <button
              onClick={() => submitInterest(stickyEmailRef.current?.value.trim() ?? '', stickyEmailRef)}
              className="bg-orange-600 hover:bg-orange-500 text-black font-black px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20"
            >
              Register &rarr;
            </button>
          </div>
          <button onClick={dismissStickyBar} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0 p-1" aria-label="Dismiss">
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style jsx global>{`
        @keyframes shimmer { to { background-position: 200% center; } }
      `}</style>
    </div>
  )
}
