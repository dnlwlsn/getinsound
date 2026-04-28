'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { useViewMode } from '@/lib/useViewMode'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import { Badge } from '@/app/components/ui/Badge'
import { VerifiedTick } from '@/app/components/ui/VerifiedTick'
import { FavouriteButton } from '@/app/components/ui/FavouriteButton'

type ArtistResult = {
  id: string
  slug: string
  name: string
  avatar_url: string | null
  bio: string | null
  release_count: number
  badge?: { badge_type: string; metadata?: { position?: number } | null } | null
  verified?: boolean
}

type ReleaseResult = {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  genre: string | null
  price_pence: number
  currency: string
  artist_id: string
  artist_name: string
  artist_slug: string
}

type Results = { artists: ArtistResult[]; releases: ReleaseResult[] }

export default function SearchClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(q)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(!!q)
  const inputRef = useRef<HTMLInputElement>(null)
  const { mode, set: setViewMode } = useViewMode()
  const { formatPrice, convertPrice, currency: fanCurrency } = useCurrency()

  const fetchResults = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
      const data: Results = await res.json()
      setResults(data)
    } catch {
      setResults({ artists: [], releases: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setInputValue(q)
    fetchResults(q)
    if (!q) setHasSearched(false)
  }, [q, fetchResults])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const displayPrice = (pence: number, currency: string) => {
    const converted = convertPrice(pence / 100, currency, fanCurrency)
    return formatPrice(converted, fanCurrency)
  }

  return (
    <div className="min-h-screen bg-insound-bg">
      {/* Search input */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-10 pb-2">
        <form onSubmit={handleSubmit} className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search artists, releases…"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none text-white placeholder-zinc-600 focus:border-orange-600 transition-colors"
          />
        </form>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-6">
        {loading && (
          <p className="text-center text-zinc-600 font-bold text-sm py-20">Searching...</p>
        )}

        {!loading && !hasSearched && (
          <p className="text-center text-zinc-500 text-sm py-20">
            Enter a search term to find artists and releases.
          </p>
        )}

        {!loading && hasSearched && results && results.artists.length === 0 && results.releases.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-sm font-bold">No artists or releases match &ldquo;{q}&rdquo;</p>
            <p className="text-zinc-600 text-xs mt-2">Try a different search term</p>
          </div>
        )}

        {!loading && results && (results.artists.length > 0 || results.releases.length > 0) && (
          <>
            {/* Artists */}
            {results.artists.length > 0 && (
              <section className="mb-12">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Artists <span className="text-zinc-700">({results.artists.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {results.artists.map(a => (
                    <Link key={a.id} href={`/${a.slug}`}>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all duration-150"
                      >
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/[0.1]" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-800 ring-1 ring-white/[0.1] flex items-center justify-center text-sm font-bold text-zinc-400">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-display font-bold text-sm text-white truncate">
                              {a.name}
                            </p>
                            {a.verified && <VerifiedTick size={14} />}
                            {a.badge && <Badge type={a.badge.badge_type} position={a.badge.metadata?.position} size="xs" />}
                          </div>
                          {a.bio && <p className="text-xs text-zinc-500 truncate">{a.bio.slice(0, 80)}</p>}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
                          {a.release_count} {a.release_count === 1 ? 'release' : 'releases'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Releases */}
            {results.releases.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Releases <span className="text-zinc-700">({results.releases.length})</span>
                  </h2>
                  <ViewToggle mode={mode} onToggle={setViewMode} />
                </div>

                {mode === 'expanded' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                    {results.releases.map(r => (
                      <Link key={r.id} href={`/release?a=${r.artist_slug}&r=${r.slug}`} className="group">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06] mb-2">
                          {r.cover_url ? (
                            <img src={r.cover_url} alt={r.title} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-full bg-zinc-800" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white truncate">{r.title}</h3>
                        <p className="text-xs text-zinc-500 truncate">{r.artist_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{r.type}</span>
                          <span className="text-xs font-bold text-white">
                            {displayPrice(r.price_pence, r.currency)}
                          </span>
                          <FavouriteButton releaseId={r.id} size={14} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.releases.map(r => (
                      <Link
                        key={r.id}
                        href={`/release?a=${r.artist_slug}&r=${r.slug}`}
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all"
                      >
                        {r.cover_url ? (
                          <img src={r.cover_url} alt={r.title} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/[0.1]" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 ring-1 ring-white/[0.1]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{r.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{r.artist_name}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 shrink-0">{r.type}</span>
                        <span className="text-xs font-bold text-white shrink-0">
                          {displayPrice(r.price_pence, r.currency)}
                        </span>
                        <FavouriteButton releaseId={r.id} size={16} />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
