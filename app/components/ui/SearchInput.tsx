'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ArtistResult = {
  id: string
  slug: string
  name: string
  avatar_url: string | null
  bio: string | null
  release_count: number
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

export function SearchInput({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback((q: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=3`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: Results) => {
        setResults(data)
        setOpen(true)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (value.trim().length < 2) {
      setOpen(false)
      setResults(null)
      return
    }
    timerRef.current = setTimeout(() => fetchResults(value.trim()), 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      setOpen(false)
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const hasResults = results && (results.artists.length > 0 || results.releases.length > 0)
  const noResults = results && results.artists.length === 0 && results.releases.length === 0

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search icon */}
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim().length >= 2 && results) setOpen(true) }}
        placeholder="Search artists, releases, genres..."
        className="bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-10 text-sm w-full outline-none text-white placeholder-zinc-600 focus:border-orange-600 transition-colors
"
      />

      {query && (
        <button
          onClick={() => { setQuery(''); setResults(null); setOpen(false) }}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50
">

          {loading && (
            <div className="px-4 py-3 text-xs text-zinc-500 text-center">Searching...</div>
          )}

          {!loading && noResults && (
            <div className="px-4 py-3 text-xs text-zinc-500 text-center">
              No results for &ldquo;{query.trim()}&rdquo;
            </div>
          )}

          {!loading && hasResults && (
            <>
              {results.artists.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Artists</div>
                  {results.artists.map(a => (
                    <Link
                      key={a.id}
                      href={`/${a.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors
"
                    >
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/[0.1]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 ring-1 ring-white/[0.1] flex items-center justify-center text-xs font-bold text-zinc-400">
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{a.name}</p>
                        {a.bio && (
                          <p className="text-xs text-zinc-500 truncate">{a.bio.slice(0, 60)}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.releases.length > 0 && (
                <div className={results.artists.length > 0 ? 'border-t border-zinc-800' : ''}>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Releases</div>
                  {results.releases.map(r => (
                    <Link
                      key={r.id}
                      href={`/release?a=${r.artist_slug}&r=${r.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors
"
                    >
                      {r.cover_url ? (
                        <img src={r.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/[0.1]" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 ring-1 ring-white/[0.1]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{r.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{r.artist_name}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 shrink-0">{r.type}</span>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-xs font-bold text-orange-600 hover:text-orange-500 text-center border-t border-zinc-800 transition-colors
"
              >
                View all results
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
