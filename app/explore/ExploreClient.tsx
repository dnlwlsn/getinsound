'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { calculateFees } from '@/app/lib/fees'
import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'

const RELEASE_TYPES = ['album', 'ep', 'single'] as const
type ReleaseType = typeof RELEASE_TYPES[number]

interface Track {
  id: number
  title: string
  artist: string
  genre: string
  origin: string
  price: string
  img: string
  isNew: boolean
  type: ReleaseType
}

const data: Track[] = []

const GENRES = ['All','Indie','Electronic','Lo-Fi','Hip-Hop','Jazz'] as const
const PAGE_SIZE = 20

const FEATURED: { id: number; title: string; artist: string; origin?: string; genre?: string; price: string; img: string }[] = []

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
function BagIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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
    <svg width={size} height={size} fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ExploreClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [basket, setBasket] = useState<Track[]>([])
  const [currentGenre, setCurrentGenre] = useState('All')
  const [currentReleaseType, setCurrentReleaseType] = useState<'albums' | 'all'>('albums')
  const [currentSort, setCurrentSort] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [cartOpen, setCartOpen] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [successAmount, setSuccessAmount] = useState({ total: '0.00', artist: '0.00' })
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  // Register interest state
  const [registered, setRegistered] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stickyDismissed, setStickyDismissed] = useState(false)
  const registerEmailRef = useRef<HTMLInputElement>(null)
  const stickyEmailRef = useRef<HTMLInputElement>(null)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot: simulate skeleton loading
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  // Check localStorage for registered state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('insound_interested')) setRegistered(true)
      if (sessionStorage.getItem('insound_bar_dismissed')) setStickyDismissed(true)
    }
  }, [])

  // Sticky bar scroll listener
  useEffect(() => {
    if (registered || stickyDismissed) return
    const handler = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1)
      if (pct > 0.35) setStickyVisible(true)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [registered, stickyDismissed])

  /* ── Genre counts ─────────────────────────────────────────── */
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { All: data.length }
    GENRES.forEach(g => {
      if (g !== 'All') counts[g] = data.filter(t => t.genre === g).length
    })
    return counts
  }, [])

  /* ── Filtering & sorting ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let items = data.filter(t => {
      const matchesGenre = currentGenre === 'All' || t.genre === currentGenre
      const matchesType = currentReleaseType === 'all' || t.type === 'album' || t.type === 'ep'
      return matchesGenre && matchesType
    })
    if (currentSort === 'price-low') items = [...items].sort((a, b) => +a.price - +b.price)
    else if (currentSort === 'price-high') items = [...items].sort((a, b) => +b.price - +a.price)
    else if (currentSort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title))
    else {
      const typeOrder: Record<string, number> = { album: 0, ep: 1, single: 2 }
      items = [...items].sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2))
    }
    return items
  }, [currentGenre, currentReleaseType, currentSort])

  const visibleItems = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visibleCount

  /* ── Cart math ────────────────────────────────────────────── */
  const cartTotal = basket.reduce((s, t) => s + parseFloat(t.price), 0)
  const { stripeFee, artistReceived: artistShare } = cartTotal > 0 ? calculateFees(cartTotal) : { stripeFee: 0, artistReceived: 0 }

  /* ── Toast helper ─────────────────────────────────────────── */
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  /* ── Actions ──────────────────────────────────────────────── */
  const addToCart = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    e.preventDefault()
    const t = data.find(x => x.id === id)!
    if (basket.find(x => x.id === id)) {
      showToast('Already in your basket')
      return
    }
    const newBasket = [...basket, t]
    setBasket(newBasket)
    showToast(`\u2713 ${t.title} added to basket`)
    if (newBasket.length === 1) setTimeout(() => setCartOpen(true), 300)
  }, [basket, showToast])

  const removeFromCart = useCallback((id: number) => {
    setBasket(prev => prev.filter(x => x.id !== id))
  }, [])

  const clearCart = useCallback(() => setBasket([]), [])

  const toggleCart = useCallback(() => setCartOpen(prev => !prev), [])

  const handleCheckout = useCallback(() => {
    if (basket.length === 0) return
    setProcessing(true)
    const total = basket.reduce((s, t) => s + parseFloat(t.price), 0)
    setTimeout(() => {
      setCartOpen(false)
      setSuccessAmount({ total: formatPrice(convertPrice(total, 'GBP', currency)), artist: formatPrice(convertPrice(total - (total * 0.10) - (total * 0.015 + 0.20), 'GBP', currency)) })
      setSuccessModal(true)
      setBasket([])
      setProcessing(false)
    }, 1600)
  }, [basket])

  const setGenre = useCallback((genre: string) => {
    setCurrentGenre(genre)
    setVisibleCount(PAGE_SIZE)
  }, [])

  const headingText = currentGenre === 'All' ? 'All Releases' : currentGenre

  const isInCart = useCallback((id: number) => basket.some(x => x.id === id), [basket])

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
      {/* Cart floating button */}
      <div className="fixed top-4 right-4 z-50">
        <button onClick={toggleCart} className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 relative hover:border-zinc-700 transition-colors">
          <BagIcon />
          {basket.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
              {basket.length}
            </span>
          )}
        </button>
      </div>

      {/* FEATURED HERO */}
      <section className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Featured This Week</h2>
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden sm:block">Hand-picked by the team</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Large featured */}
            <Link
              href={`/player?id=${FEATURED[0].id}&title=${encodeURIComponent(FEATURED[0].title)}&artist=${encodeURIComponent(FEATURED[0].artist)}&price=${FEATURED[0].price}&img=${encodeURIComponent(FEATURED[0].img)}`}
              className="sm:col-span-1 group relative rounded-2xl overflow-hidden aspect-square sm:aspect-auto sm:h-56 bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={FEATURED[0].img} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="Album artwork" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute top-3 left-3 bg-orange-600 text-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{"Editor's Pick"}</div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="font-black text-lg leading-tight">{FEATURED[0].title}</p>
                <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{FEATURED[0].artist} &middot; {FEATURED[0].origin} &middot; {FEATURED[0].genre}</p>
                <p className="text-orange-600 font-black text-sm mt-2">{formatPrice(convertPrice(parseFloat(FEATURED[0].price), 'GBP', currency))}</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-orange-600 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl">
                  <PlayIcon size={22} />
                </div>
              </div>
            </Link>
            {/* 4 smaller featured */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              {FEATURED.slice(1).map(f => (
                <Link
                  key={f.id}
                  href={`/player?id=${f.id}&title=${encodeURIComponent(f.title)}&artist=${encodeURIComponent(f.artist)}&price=${f.price}&img=${encodeURIComponent(f.img)}`}
                  className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 hover:border-orange-600/40 transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.img} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 absolute inset-0" alt="Album artwork" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="font-black text-sm leading-tight">{f.title}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.artist}</p>
                    <p className="text-orange-600 font-black text-xs mt-1.5">{formatPrice(convertPrice(parseFloat(f.price), 'GBP', currency))}</p>
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

      {/* BROWSE ALL */}
      <main className="max-w-7xl mx-auto px-5 md:px-10 py-8">
        {/* Filters + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            {GENRES.map(g => (
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

        {/* Grid / List */}
        {!loading && filtered.length > 0 && viewMode === 'expanded' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {visibleItems.map(t => {
              const inCart = isInCart(t.id)
              return (
                <div key={t.id} className="group cursor-pointer">
                  <div className={`aspect-square rounded-2xl overflow-hidden border ${inCart ? 'border-orange-600/50' : 'border-zinc-800 group-hover:border-zinc-700'} transition-all mb-3 relative bg-zinc-900`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105" loading="lazy" alt={t.title} />
                    {t.isNew && (
                      <span className="absolute top-2 left-2 bg-orange-600 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider z-10">New</span>
                    )}
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-orange-600/90 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider z-10">In basket</span>
                    )}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2.5 px-4">
                      <Link
                        href={`/player?id=${t.id}&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}&price=${t.price}&img=${encodeURIComponent(t.img)}`}
                        className="w-full bg-white text-black text-[10px] font-black py-2 rounded-full hover:bg-orange-600 hover:text-white transition-colors text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        &#9654; Play
                      </Link>
                      <button
                        onClick={e => addToCart(e, t.id)}
                        className="w-full bg-black/50 border border-white/25 text-white text-[10px] font-black py-2 rounded-full hover:bg-white hover:text-black transition-colors"
                      >
                        {inCart ? '\u2713 Added' : `+ ${formatPrice(convertPrice(parseFloat(t.price), 'GBP', currency))}`}
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-sm truncate">{t.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate mt-0.5">{t.artist}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-zinc-700 font-bold">{t.origin}</span>
                    <span className="text-xs font-black text-orange-600">{formatPrice(convertPrice(parseFloat(t.price), 'GBP', currency))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && viewMode === 'compact' && (
          <div className="flex flex-col gap-1">
            {visibleItems.map(t => {
              const inCart = isInCart(t.id)
              return (
                <div key={t.id} className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                  <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} className="w-full h-full object-cover" loading="lazy" alt={t.title} />
                  </div>
                  <span className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0">{t.title}</span>
                  <span className="hidden md:block text-[13px] text-zinc-500 truncate w-36 flex-shrink-0">{t.artist}</span>
                  <span className="hidden lg:inline-flex items-center bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0">
                    {t.genre}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[13px] font-semibold text-orange-600 flex-shrink-0">{formatPrice(convertPrice(parseFloat(t.price), 'GBP', currency))}</span>
                  <Link
                    href={`/player?id=${t.id}&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}&price=${t.price}&img=${encodeURIComponent(t.img)}`}
                    className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shrink-0 hover:bg-orange-500 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </Link>
                  <button
                    onClick={e => addToCart(e, t.id)}
                    className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04] transition-all shrink-0"
                  >
                    {inCart ? '✓ Added' : `+ ${formatPrice(convertPrice(parseFloat(t.price), 'GBP', currency))}`}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-5">
              <SearchIcon className="text-zinc-600" />
            </div>
            <p className="font-black text-zinc-400 text-lg mb-2">No results found</p>
            <p className="text-sm text-zinc-600 mb-5">Try a different search or genre</p>
            <button
              onClick={() => setGenre('All')}
              className="text-xs font-black text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors"
            >
              Clear filters
            </button>
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

      {/* Cart Overlay */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/70 z-[90] backdrop-blur-sm" onClick={toggleCart} />
      )}

      {/* Cart Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-zinc-900 border-l border-zinc-800 z-[100] transform transition-transform duration-300 flex flex-col shadow-2xl ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-black">Your Basket</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">We only take 10%. Every fee shown at checkout.</p>
          </div>
          <button onClick={toggleCart} className="text-zinc-500 hover:text-white transition-colors p-1">
            <CloseIcon />
          </button>
        </div>

        {basket.length > 0 ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {basket.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-black/50 p-3.5 rounded-2xl border border-zinc-800/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-zinc-700" alt="Album artwork" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{t.title}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t.artist}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-black text-sm">{formatPrice(convertPrice(parseFloat(t.price), 'GBP', currency))}</p>
                  <button onClick={() => removeFromCart(t.id)} className="text-zinc-600 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors mt-0.5 block">Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-8">
            <svg width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-4 opacity-30">
              <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="font-bold text-sm">Your basket is empty</p>
            <p className="text-xs mt-1.5 text-center leading-relaxed">Add some music to support<br />artists directly</p>
          </div>
        )}

        <div className="p-5 border-t border-zinc-800 space-y-3">
          <div className="flex justify-between text-xs font-bold text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
              To artist (after fees)
            </span>
            <span>{formatPrice(convertPrice(artistShare, 'GBP', currency))}</span>
          </div>
          <div className="flex justify-between font-black text-xl">
            <span>Total</span>
            <span>{formatPrice(convertPrice(cartTotal, 'GBP', currency))}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={processing || basket.length === 0}
            className="w-full bg-orange-600 text-black font-black py-4 rounded-2xl hover:bg-orange-500 active:scale-[.98] transition-all text-sm uppercase tracking-wider disabled:opacity-60"
          >
            {processing ? 'Processing...' : 'Pay Now'}
          </button>
          {basket.length > 0 && (
            <button onClick={clearCart} className="w-full text-zinc-600 hover:text-red-400 font-bold text-xs py-1 transition-colors uppercase tracking-widest">
              Clear basket
            </button>
          )}
        </div>
      </aside>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSuccessModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-8 sm:p-10 w-full sm:max-w-sm text-center shadow-2xl">
            <div className="w-20 h-20 bg-orange-600/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckIcon />
            </div>
            <h3 className="text-2xl font-black mb-2">Purchase complete!</h3>
            <p className="text-zinc-400 text-sm mb-2 leading-relaxed">Your music is downloading. The artist has been paid directly.</p>
            <div className="text-sm mb-8">
              <span className="text-white font-black block mb-1">Total: {successAmount.total}</span>
              <span className="text-orange-500">{successAmount.artist} transferred directly to the artists.</span>
            </div>
            <Link href="/library" className="block w-full bg-orange-600 text-black font-black py-4 rounded-2xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider mb-3">
              View My Collection
            </Link>
            <button onClick={() => setSuccessModal(false)} className="w-full text-zinc-500 font-bold text-sm py-2 hover:text-white transition-colors">
              Continue Browsing
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-2xl z-[300] transition-all duration-300 whitespace-nowrap ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {toast}
      </div>

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
