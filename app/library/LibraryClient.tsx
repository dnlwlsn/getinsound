'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'

/* ── Types ──────────────────────────────────────────────────── */
interface Track {
  id: string
  title: string
  artist: string
  genre: string
  price: string
  img: string
}

/* ── Data ───────────────────────────────────────────────────── */
const collection: Track[] = []

const GENRES = ['All', 'Indie', 'Electronic', 'Lo-Fi'] as const
type Genre = (typeof GENRES)[number]

type SortOption = 'default' | 'artist' | 'price'

/* ── Component ──────────────────────────────────────────────── */
export default function LibraryClient() {
  const [activeGenre, setActiveGenre] = useState<Genre>('All')
  const [sort, setSort] = useState<SortOption>('default')
  const [toastText, setToastText] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Filter + sort */
  const filtered = (() => {
    let items =
      activeGenre === 'All'
        ? [...collection]
        : collection.filter((t) => t.genre === activeGenre)
    if (sort === 'artist') items.sort((a, b) => a.artist.localeCompare(b.artist))
    if (sort === 'price')
      items.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    return items
  })()

  /* Toast */
  const showToast = useCallback((msg: string) => {
    setToastText(msg)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500)
  }, [])

  const handleDownload = (e: React.MouseEvent, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    showToast(`\u2193 Downloading ${title}.wav...`)
  }

  /* Stats */
  const totalContributed = collection
    .reduce((s, t) => s + parseFloat(t.price), 0)
    .toFixed(2)
  const tracksOwned = collection.length
  const uniqueArtists = new Set(collection.map((t) => t.artist)).size

  return (
    <div className="min-h-screen font-display">
      {/* NAV */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-zinc-900 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <Link
          href="/"
          className="text-xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors"
        >
          insound.
        </Link>
        <div className="flex gap-4 items-center">
          <Link
            href="/explore"
            className="text-xs font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            Back to Store
          </Link>
          <Link
            href="/dashboard"
            className="bg-zinc-800 h-9 w-9 rounded-full border border-zinc-700 overflow-hidden hover:border-orange-600 transition-colors block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dan"
              className="w-full h-full"
              alt="Avatar"
              loading="lazy"
            />
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
          <div>
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              Your Collection
            </p>
            <h1 className="text-5xl font-black tracking-tighter mb-2">My Music</h1>
            <p className="text-zinc-400 font-medium">
              You have supported{' '}
              <span className="text-white font-bold">{uniqueArtists} artists</span>{' '}
              directly.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Total Contributed
              </p>
              <p className="text-2xl font-black text-orange-600">
                &pound;{totalContributed}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Tracks Owned
              </p>
              <p className="text-2xl font-black">{tracksOwned}</p>
            </div>
          </div>
        </div>

        {/* Filter / Sort bar */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {GENRES.map((genre) => {
              const isActive = activeGenre === genre
              return (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all ${
                    isActive
                      ? 'border-orange-600 bg-orange-600/10 text-orange-500'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              )
            })}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors"
          >
            <option value="default">Recently Added</option>
            <option value="artist">By Artist</option>
            <option value="price">By Price</option>
          </select>
        </div>

        {/* Collection Grid */}
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-zinc-600">
            <p className="font-bold text-sm mb-2">Your collection is empty.</p>
            <p className="text-xs">
              <Link
                href="/explore"
                className="text-orange-600 hover:text-orange-500 font-black"
              >
                Explore music &rarr;
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filtered.map((t) => (
              <div key={t.id} className="group">
                <div className="aspect-square rounded-2xl overflow-hidden mb-4 border border-zinc-800 group-hover:scale-[1.02] transition-all duration-400 relative shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.img}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    alt={t.title}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                    <Link
                      href={`/player?id=${t.id}&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}&price=${t.price}&img=${encodeURIComponent(t.img)}`}
                      className="bg-orange-600 text-black font-black px-5 py-2.5 rounded-full text-[10px] uppercase tracking-wider hover:bg-orange-500 transition-colors w-full text-center"
                    >
                      &#9654; Play
                    </Link>
                    <button
                      onClick={(e) => handleDownload(e, t.title)}
                      className="bg-white/10 border border-white/20 text-white font-black px-5 py-2.5 rounded-full text-[10px] uppercase tracking-wider hover:bg-white/20 transition-colors w-full"
                    >
                      &darr; Download WAV
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-sm truncate">{t.title}</h3>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5 truncate">
                  {t.artist}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-zinc-600 font-bold">{t.genre}</span>
                  <span className="text-[10px] font-black text-orange-600">
                    &pound;{t.price} paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[300] transition-all duration-300 ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {toastText}
      </div>
    </div>
  )
}
