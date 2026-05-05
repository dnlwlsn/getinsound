'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'
import { generateGradient } from '@/lib/gradient'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { Badge } from '@/app/components/ui/Badge'
import { VerifiedTick } from '@/app/components/ui/VerifiedTick'
import type { LibraryRelease } from './page'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'
import { getTrackingUrl } from '@/lib/carriers'
import { NotificationOptIn } from '@/app/components/pwa/NotificationOptIn'
import { useToast } from '@/app/providers/ToastProvider'

type SortOption = 'newest' | 'oldest' | 'title' | 'artist'
type TrackSortOption = 'purchased' | 'artist' | 'title'
type DateRange = 'all' | '7d' | '30d' | '90d' | '1y'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'All Time',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'Last Year',
}

export interface MerchOrderItem {
  id: string
  merch_id: string
  variant_selected: string | null
  amount_paid: number
  amount_paid_currency: string
  tracking_number: string | null
  carrier: string | null
  status: string
  created_at: string
  dispatched_at: string | null
  delivered_at: string | null
  return_requested_at: string | null
  merch: { name: string; photos: string[] } | null
  artists: { name: string; slug: string; accent_colour: string | null } | null
}

export interface FavouriteItem {
  favouriteId: string
  type: 'track' | 'release'
  trackId: string | null
  trackTitle: string | null
  releaseId: string | null
  releaseSlug: string
  releaseTitle: string
  coverUrl: string | null
  pricePence: number
  currency: string
  artistName: string
  artistSlug: string
  accentColour: string | null
  savedAt: string
}

interface Props {
  releases: LibraryRelease[]
  error: string | null
  userId: string
  favourites?: FavouriteItem[]
  merchOrders?: MerchOrderItem[]
}

export default function LibraryClient({ releases, error, userId, favourites = [], merchOrders = [] }: Props) {
  const [tab, setTab] = useState<'collection' | 'wishlist' | 'orders'>('collection')
  const [artistFilter, setArtistFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [downloadModal, setDownloadModal] = useState<LibraryRelease | null>(null)
  const showToast = useToast()
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())

  const [trackSearch, setTrackSearch] = useState('')
  const [trackSort, setTrackSort] = useState<TrackSortOption>('purchased')

  const searchParams = useSearchParams()
  const router = useRouter()

  const play = usePlayerStore((s) => s.play)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  const uniqueArtists = useMemo(() => {
    const map = new Map<string, string>()
    releases.forEach((r) => map.set(r.artistId, r.artistName))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [releases])

  const filtered = useMemo(() => {
    let items = [...releases]
    if (artistFilter !== 'all') {
      items = items.filter((r) => r.artistId === artistFilter)
    }
    if (dateRange !== 'all') {
      const now = Date.now()
      const ms: Record<string, number> = {
        '7d': 7 * 86400000,
        '30d': 30 * 86400000,
        '90d': 90 * 86400000,
        '1y': 365 * 86400000,
      }
      const cutoff = now - ms[dateRange]
      items = items.filter((r) => new Date(r.purchasedAt).getTime() >= cutoff)
    }
    switch (sort) {
      case 'newest':
        items.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())
        break
      case 'oldest':
        items.sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime())
        break
      case 'title':
        items.sort((a, b) => a.releaseTitle.localeCompare(b.releaseTitle))
        break
      case 'artist':
        items.sort((a, b) => a.artistName.localeCompare(b.artistName))
        break
    }
    return items
  }, [releases, artistFilter, dateRange, sort])

  interface FlatTrack {
    id: string
    title: string
    artistName: string
    artistSlug: string
    releaseId: string
    releaseSlug: string
    releaseTitle: string
    coverUrl: string | null
    accentColour: string | null
    position: number
    durationSec: number | null
    purchasedAt: string
  }

  const allTracks = useMemo(() => {
    const tracks: FlatTrack[] = []
    for (const r of filtered) {
      if (r.preOrder) continue
      for (const t of r.tracks) {
        tracks.push({
          id: t.id,
          title: t.title,
          artistName: r.artistName,
          artistSlug: r.artistSlug,
          releaseId: r.releaseId,
          releaseSlug: r.releaseSlug,
          releaseTitle: r.releaseTitle,
          coverUrl: r.coverUrl,
          accentColour: r.accentColour,
          position: t.position,
          durationSec: t.durationSec,
          purchasedAt: r.purchasedAt,
        })
      }
    }

    const q = trackSearch.toLowerCase().trim()
    let result = q
      ? tracks.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.artistName.toLowerCase().includes(q) ||
          t.releaseTitle.toLowerCase().includes(q))
      : tracks

    switch (trackSort) {
      case 'artist':
        result = [...result].sort((a, b) => a.artistName.localeCompare(b.artistName) || a.title.localeCompare(b.title))
        break
      case 'title':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return result
  }, [filtered, trackSearch, trackSort])

  const totalDurationSec = useMemo(() =>
    allTracks.reduce((s, t) => s + (t.durationSec ?? 0), 0)
  , [allTracks])

  const formatTotalDuration = (sec: number) => {
    const hr = Math.floor(sec / 3600)
    const min = Math.floor((sec % 3600) / 60)
    return hr > 0 ? `${hr} hr ${min} min` : `${min} min`
  }

  const buildFullQueue = useCallback((startIndex: number = 0): PlayerTrack[] => {
    const mapped = allTracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      artistSlug: t.artistSlug,
      releaseId: t.releaseId,
      releaseSlug: t.releaseSlug,
      releaseTitle: t.releaseTitle,
      coverUrl: t.coverUrl,
      position: t.position,
      durationSec: t.durationSec,
      accentColour: t.accentColour,
      purchased: true,
    }))
    return [...mapped.slice(startIndex), ...mapped.slice(0, startIndex)]
  }, [allTracks])

  const handlePlayAll = useCallback(() => {
    const queue = buildFullQueue()
    if (queue.length > 0) play(queue[0], queue)
  }, [buildFullQueue, play])

  const handleShuffleAll = useCallback(() => {
    const queue = buildFullQueue()
    if (queue.length === 0) return
    if (!shuffle) toggleShuffle()
    play(queue[0], queue)
  }, [buildFullQueue, play, shuffle, toggleShuffle])

  const handlePlayTrackFromList = useCallback((index: number) => {
    const queue = buildFullQueue()
    if (queue[index]) play(queue[index], queue)
  }, [buildFullQueue, play])

  const primaryCurrency = releases[0]?.displayCurrency ?? 'GBP'
  const totalAmount = releases.reduce((s, r) => s + r.displayAmount, 0)
  const totalContributed = formatPriceUtil(totalAmount / 100, primaryCurrency)
  const releasesOwned = releases.length
  const uniqueArtistCount = uniqueArtists.length

  const buildQueue = useCallback((release: LibraryRelease): PlayerTrack[] => {
    return release.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: release.artistName,
      artistSlug: release.artistSlug,
      releaseId: release.releaseId,
      releaseSlug: release.releaseSlug,
      releaseTitle: release.releaseTitle,
      coverUrl: release.coverUrl,
      position: t.position,
      durationSec: t.durationSec,
      accentColour: release.accentColour,
      purchased: true,
    }))
  }, [])

  const autoPlayedRef = useRef(false)
  useEffect(() => {
    const playReleaseId = searchParams.get('play')
    if (!playReleaseId || autoPlayedRef.current) return
    const release = releases.find(r => r.releaseId === playReleaseId)
    if (!release || release.preOrder) return
    autoPlayedRef.current = true
    const queue = buildQueue(release)
    if (queue.length > 0) play(queue[0], queue)
    router.replace('/library', { scroll: false })
  }, [searchParams, releases, buildQueue, play, router])

  const handlePlay = (release: LibraryRelease) => {
    const queue = buildQueue(release)
    if (queue.length > 0) {
      play(queue[0], queue)
    }
  }

  const handlePlayTrack = useCallback((release: LibraryRelease, trackIndex: number) => {
    const queue = buildQueue(release)
    if (queue[trackIndex]) {
      play(queue[trackIndex], queue)
    }
  }, [buildQueue, play])

  const toggleExpanded = useCallback((releaseId: string) => {
    setExpandedReleases(prev => {
      const next = new Set(prev)
      if (next.has(releaseId)) next.delete(releaseId)
      else next.add(releaseId)
      return next
    })
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (error) {
    return (
      <div className="min-h-screen font-display flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <h2 className="text-lg font-bold text-zinc-300 mb-2">We couldn&apos;t load your collection.</h2>
          <p className="text-zinc-500 text-sm mb-5">
            Try refreshing, or contact us if it keeps happening.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-orange-600 text-sm font-bold hover:text-orange-500 transition-colors"
          >
            Retry &rarr;
          </button>
        </div>
      </div>
    )
  }

  const isEmpty = releases.length === 0 && favourites.length === 0 && merchOrders.length === 0

  return (
    <div className="min-h-screen font-display pb-32 sm:pb-6">

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Header + Stats */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              Your Collection
            </p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter mb-2">My Music</h1>
            <p className="text-zinc-400 font-medium text-sm sm:text-base">
              You&apos;ve supported{' '}
              <span className="text-white font-bold">{uniqueArtistCount} {uniqueArtistCount === 1 ? 'artist' : 'artists'}</span>{' '}
              directly.
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="bg-zinc-900 border border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl text-right flex-1 md:flex-initial">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Supported
              </p>
              <p className="text-xl sm:text-2xl font-black text-orange-600">{totalContributed}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl text-right flex-1 md:flex-initial">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Owned
              </p>
              <p className="text-xl sm:text-2xl font-black">{releasesOwned}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-zinc-800 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setTab('collection')}
            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'collection' ? 'border-orange-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Collection ({releases.length})
          </button>
          <button
            onClick={() => setTab('wishlist')}
            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'wishlist' ? 'border-orange-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Wishlist ({favourites.length})
          </button>
          {merchOrders.length > 0 && (
            <button
              onClick={() => setTab('orders')}
              className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                tab === 'orders' ? 'border-orange-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Orders ({merchOrders.length})
            </button>
          )}
        </div>

        {tab === 'wishlist' && (
          <SavedTab items={favourites} />
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link href="/orders" className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors">
                View all orders →
              </Link>
            </div>
            {merchOrders.map(o => {
              const merchData = Array.isArray(o.merch) ? o.merch[0] : o.merch
              const artistData = Array.isArray(o.artists) ? o.artists[0] : o.artists
              const photo = merchData?.photos?.[0]
              const trackingUrl = getTrackingUrl(o.carrier, o.tracking_number)
              const canReturn = o.status === 'delivered' && o.delivered_at &&
                new Date().getTime() - new Date(o.delivered_at).getTime() < 14 * 24 * 60 * 60 * 1000

              return (
                <div key={o.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
                  <div className="relative w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                    {photo ? <Image src={photo} fill className="object-cover" sizes="56px" alt={merchData?.name || 'Merch item'} /> : <div className="w-full h-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{merchData?.name || 'Unknown item'}{o.variant_selected ? ` (${o.variant_selected})` : ''}</p>
                    {artistData && (
                      <Link href={`/${artistData.slug}`} className="text-[10px] font-bold hover:text-orange-500 transition-colors" style={{ color: artistData.accent_colour || '#a1a1aa' }}>
                        {artistData.name}
                      </Link>
                    )}
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatPriceUtil(o.amount_paid / 100, o.amount_paid_currency)} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        o.status === 'pending' ? 'bg-zinc-800 text-zinc-400' :
                        o.status === 'dispatched' ? 'bg-blue-900/50 text-blue-400' :
                        o.status === 'delivered' ? 'bg-green-900/50 text-green-400' :
                        o.status === 'return_requested' ? 'bg-yellow-900/50 text-yellow-400' :
                        o.status === 'returned' ? 'bg-purple-900/50 text-purple-400' :
                        o.status === 'refunded' ? 'bg-red-900/50 text-red-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {o.status.replace('_', ' ')}
                      </span>
                      {trackingUrl && (
                        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                          Track parcel
                        </a>
                      )}
                      {canReturn && (
                        <OrderAction orderId={o.id} action="request-return" label="Request return" />
                      )}
                      {o.status === 'pending' && (
                        <OrderAction orderId={o.id} action="report-problem" label="Report a problem" />
                      )}
                      {o.status === 'dispatched' && (
                        <OrderAction orderId={o.id} action="report-problem" label="Report a problem" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'collection' && releases.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 font-medium mb-2">No releases in your collection yet.</p>
            <p className="text-zinc-600 text-sm mb-5">When you buy music, it will appear here.</p>
            <Link
              href="/explore"
              className="text-orange-600 text-sm font-bold hover:text-orange-500 transition-colors"
            >
              Explore music &rarr;
            </Link>
          </div>
        )}

        {tab === 'collection' && releases.length > 0 && <>
        {/* Filter / Sort bar */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {uniqueArtists.length > 1 && (
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors"
              >
                <option value="all">All Artists</option>
                {uniqueArtists.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
            {viewMode !== 'playlist' && (
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors"
              >
                {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((key) => (
                  <option key={key} value={key}>{DATE_RANGE_LABELS[key]}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewMode !== 'playlist' && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors"
              >
                <option value="newest">Newest Purchase</option>
                <option value="oldest">Oldest Purchase</option>
                <option value="title">By Title</option>
                <option value="artist">By Artist</option>
              </select>
            )}
            <ViewToggle mode={viewMode} onToggle={setViewMode} showPlaylist />
          </div>
        </div>

        {/* Playlist view */}
        {viewMode === 'playlist' && (
          <div className="animate-in fade-in duration-300">
            {/* Playlist header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-zinc-400 text-sm font-medium">
                  {allTracks.length} {allTracks.length === 1 ? 'track' : 'tracks'} · {formatTotalDuration(totalDurationSec)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={trackSearch}
                  onChange={e => setTrackSearch(e.target.value)}
                  placeholder="Search tracks..."
                  className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-300 text-xs font-medium placeholder:text-zinc-600 focus:border-orange-600 transition-colors w-full sm:w-44"
                />
                <select
                  value={trackSort}
                  onChange={e => setTrackSort(e.target.value as TrackSortOption)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors flex-1 sm:flex-none"
                >
                  <option value="purchased">Recently Purchased</option>
                  <option value="artist">A-Z by Artist</option>
                  <option value="title">A-Z by Title</option>
                </select>
                <button
                  onClick={handlePlayAll}
                  disabled={allTracks.length === 0}
                  className="bg-orange-600 text-black font-black px-5 py-2 rounded-full text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  <span className="hidden sm:inline">Play All</span>
                  <span className="sm:hidden">Play</span>
                </button>
                <button
                  onClick={handleShuffleAll}
                  disabled={allTracks.length === 0}
                  className="bg-white/10 border border-white/20 text-white font-black px-5 py-2 rounded-full text-xs uppercase tracking-wider hover:bg-white/20 transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
                  <span className="hidden sm:inline">Shuffle</span>
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-3 h-8 text-[10px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-800/50 mb-1">
              <span className="w-8 text-right shrink-0">#</span>
              <span className="flex-1 min-w-0">Title</span>
              <span className="hidden md:block w-36 shrink-0">Artist</span>
              <span className="hidden md:block w-36 shrink-0">Album</span>
              <span className="hidden sm:block w-12 text-right shrink-0">Time</span>
            </div>

            {/* Track rows */}
            <div className="flex flex-col">
              {allTracks.map((track, idx) => {
                const playing = currentTrack?.id === track.id
                return (
                  <button
                    key={`${track.id}-${idx}`}
                    onClick={() => handlePlayTrackFromList(idx)}
                    className={`group flex items-center gap-3 px-3 rounded-lg transition-colors text-left ${
                      playing ? 'bg-orange-600/10' : 'hover:bg-zinc-900'
                    }`}
                    style={{ minHeight: '48px' }}
                  >
                    <span className="w-8 text-right shrink-0">
                      {playing && isPlaying ? (
                        <span className="inline-flex items-center gap-[2px]" style={{ color: track.accentColour ?? '#F56D00' }}>
                          <span className="w-[3px] h-3 rounded-full animate-pulse" style={{ background: 'currentColor' }} />
                          <span className="w-[3px] h-4 rounded-full animate-pulse" style={{ background: 'currentColor', animationDelay: '0.15s' }} />
                          <span className="w-[3px] h-2.5 rounded-full animate-pulse" style={{ background: 'currentColor', animationDelay: '0.3s' }} />
                        </span>
                      ) : (
                        <>
                          <span className={`text-[13px] font-medium hidden sm:inline group-hover:hidden ${playing ? 'text-orange-500' : 'text-zinc-600'}`}>
                            {idx + 1}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="sm:hidden inline text-white ml-auto sm:group-hover:inline">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {track.coverUrl && (
                        <img
                          src={track.coverUrl}
                          alt=""
                          className="w-8 h-8 rounded shrink-0 object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className={`text-sm font-semibold truncate ${playing ? 'text-orange-500' : 'text-white'}`}>
                        {track.title}
                      </span>
                    </div>

                    <span className="hidden md:block w-36 shrink-0">
                      <Link
                        href={`/${track.artistSlug}`}
                        onClick={e => e.stopPropagation()}
                        className={`text-[13px] truncate block hover:text-orange-500 transition-colors ${playing ? 'text-orange-400' : 'text-zinc-500'}`}
                      >
                        {track.artistName}
                      </Link>
                    </span>

                    <span className={`hidden md:block w-36 shrink-0 text-[13px] truncate ${playing ? 'text-orange-400/70' : 'text-zinc-600'}`}>
                      {track.releaseTitle}
                    </span>

                    <span className={`hidden sm:block w-12 text-right shrink-0 text-[13px] ${playing ? 'text-orange-400/70' : 'text-zinc-600'}`}>
                      {formatDuration(track.durationSec)}
                    </span>
                  </button>
                )
              })}
            </div>

            {allTracks.length === 0 && (
              <div className="text-center py-16">
                <p className="text-zinc-500 font-medium">
                  {trackSearch ? 'No tracks match your search.' : 'No tracks in your collection.'}
                </p>
                {trackSearch && (
                  <button
                    onClick={() => setTrackSearch('')}
                    className="text-orange-600 text-sm font-bold mt-2 hover:text-orange-500 transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Releases - animated view transition */}
        {viewMode !== 'playlist' && (
        <div
          className="transition-all duration-300 ease-in-out"
          style={{ opacity: 1 }}
        >
          {viewMode === 'expanded' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8 animate-in fade-in duration-300">
              {filtered.map((r) => (
                <ReleaseCard
                  key={r.purchaseId}
                  release={r}
                  onPlay={() => handlePlay(r)}
                  onDownload={() => setDownloadModal(r)}
                  formatDate={formatDate}
                  showToast={showToast}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1 animate-in fade-in duration-300">
              {filtered.map((r) => (
                <ReleaseRowCompact
                  key={r.purchaseId}
                  release={r}
                  expanded={expandedReleases.has(r.releaseId)}
                  onToggleExpand={() => toggleExpanded(r.releaseId)}
                  onPlay={() => handlePlay(r)}
                  onPlayTrack={(idx) => handlePlayTrack(r, idx)}
                  onDownload={() => setDownloadModal(r)}
                  showToast={showToast}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {filtered.length === 0 && releases.length > 0 && viewMode !== 'playlist' && (
          <div className="text-center py-16">
            <p className="text-zinc-500 font-medium">No releases match your filters.</p>
            <button
              onClick={() => { setArtistFilter('all'); setDateRange('all') }}
              className="text-orange-600 text-sm font-bold mt-2 hover:text-orange-500 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
        </>}
      </div>

      {downloadModal && (
        <FormatSelectorModal
          release={downloadModal}
          onClose={() => setDownloadModal(null)}
          showToast={showToast}
        />
      )}

      <NotificationOptIn show={releases.length > 0} />
    </div>
  )
}

/* ── Release Card (expanded grid) ───────────────────────────── */

function ReleaseCard({
  release,
  onPlay,
  onDownload,
  formatDate,
  showToast,
}: {
  release: LibraryRelease
  onPlay: () => void
  onDownload: () => void
  formatDate: (iso: string) => string
  showToast: (msg: string) => void
}) {
  const gradient = release.coverUrl ? null : generateGradient(release.artistId, release.releaseId)
  const borderStyle = release.accentColour
    ? { borderColor: `${release.accentColour}33` }
    : undefined

  return (
    <div className="group">
      <div
        className="aspect-square rounded-2xl overflow-hidden mb-4 border border-zinc-800 group-hover:scale-[1.02] transition-all duration-300 relative shadow-xl"
        style={borderStyle}
      >
        {release.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={release.coverUrl}
            className="w-full h-full object-cover"
            loading="lazy"
            alt={release.releaseTitle}
          />
        ) : (
          <div className="w-full h-full" style={{ background: gradient?.css }} />
        )}

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
          {release.preOrder ? (
            <div className="text-center px-2">
              <p className="text-zinc-300 text-xs font-bold mb-1">Available on</p>
              <p className="text-white font-black text-sm">
                {release.releaseDate
                  ? new Date(release.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'TBA'}
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={onPlay}
                className="bg-orange-600 text-black font-black px-5 py-2.5 rounded-full text-[10px] uppercase tracking-wider hover:bg-orange-500 transition-colors w-full text-center"
              >
                &#9654; Play
              </button>
              <button
                onClick={onDownload}
                className="bg-white/10 border border-white/20 text-white font-black px-5 py-2.5 rounded-full text-[10px] uppercase tracking-wider hover:bg-white/20 transition-colors w-full"
              >
                &darr; Download
              </button>
              {release.downloadExpired && (
                <RedownloadButton purchaseId={release.purchaseId} onSuccess={showToast} />
              )}
            </>
          )}
        </div>

        {release.preOrder && (
          <div className="absolute top-3 left-3">
            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-orange-600/40 text-orange-500 bg-black/70 backdrop-blur-sm">
              Pre-order
            </span>
          </div>
        )}
      </div>

      <h3 className="font-bold text-sm truncate">{release.releaseTitle}</h3>
      <div className="flex items-center gap-1 mt-0.5">
        <Link
          href={`/${release.artistSlug}`}
          className="text-[10px] text-zinc-500 font-black uppercase tracking-widest truncate hover:text-orange-600 transition-colors"
        >
          {release.artistName}
        </Link>
        {release.artistVerified && <VerifiedTick size={12} />}
        {release.artistBadge && <Badge type={release.artistBadge.badge_type} position={release.artistBadge.metadata?.position} size="xs" />}
      </div>
      <p className="text-[10px] text-zinc-600 font-bold mt-1.5">
        {formatDate(release.purchasedAt)}
      </p>
    </div>
  )
}

/* ── Compact Row ────────────────────────────────────────────── */

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ReleaseRowCompact({
  release,
  expanded,
  onToggleExpand,
  onPlay,
  onPlayTrack,
  onDownload,
  showToast,
}: {
  release: LibraryRelease
  expanded: boolean
  onToggleExpand: () => void
  onPlay: () => void
  onPlayTrack: (trackIndex: number) => void
  onDownload: () => void
  showToast: (msg: string) => void
}) {
  const gradient = release.coverUrl ? null : generateGradient(release.artistId, release.releaseId)
  const isMultiTrack = release.releaseType !== 'single' && release.tracks.length > 1

  return (
    <div className="rounded-xl">
      <div className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-zinc-900 transition-colors">
        {isMultiTrack && (
          <button
            onClick={onToggleExpand}
            className="w-5 h-5 flex items-center justify-center shrink-0 text-zinc-500 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse tracks' : 'Expand tracks'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={`transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}
            >
              <line x1="7" y1="2" x2="7" y2="12" />
              <line x1="2" y1="7" x2="12" y2="7" />
            </svg>
          </button>
        )}

        <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
          {release.coverUrl ? (
            <Image src={release.coverUrl} fill className="object-cover" sizes="40px" alt={release.releaseTitle} />
          ) : (
            <div className="w-full h-full" style={{ background: gradient?.css }} />
          )}
        </div>

        <span className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0">
          {release.releaseTitle}
        </span>

        <span className="hidden md:flex items-center gap-1 w-36 flex-shrink-0">
          <Link
            href={`/${release.artistSlug}`}
            className="text-[13px] text-zinc-500 truncate hover:text-orange-600 transition-colors"
          >
            {release.artistName}
          </Link>
          {release.artistBadge && <Badge type={release.artistBadge.badge_type} position={release.artistBadge.metadata?.position} size="xs" />}
        </span>

        {release.tags.length > 0 && (
          <span className="hidden lg:flex gap-1 flex-shrink-0">
            {release.tags.map(tag => (
              <span key={tag} className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </span>
        )}

        <span className="flex-1" />

        {!release.preOrder && (
          <button
            onClick={onPlay}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
            style={{ background: release.accentColour ?? '#F56D00' }}
            aria-label="Play"
          >
            <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {!release.preOrder && (
          <button
            onClick={onDownload}
            className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-transparent ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04] transition-all shrink-0"
          >
            &darr; Download
          </button>
        )}
        {!release.preOrder && release.downloadExpired && (
          <div className="hidden sm:block shrink-0">
            <RedownloadButton purchaseId={release.purchaseId} onSuccess={showToast} />
          </div>
        )}
      </div>

      {isMultiTrack && (
        <div
          className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
          style={{ maxHeight: expanded ? `${release.tracks.length * 40 + 8}px` : '0px' }}
        >
          <div className="pl-11 md:pl-12 pr-3 pb-2">
            {release.tracks.map((track, idx) => (
              <div
                key={track.id}
                className="group/track flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <span className="text-[11px] text-zinc-600 font-bold w-5 text-right shrink-0">
                  {track.position}
                </span>
                <span className="text-[13px] text-zinc-300 truncate min-w-0 flex-1">
                  {track.title}
                </span>
                <span className="text-[11px] text-zinc-600 font-medium shrink-0">
                  {formatDuration(track.durationSec)}
                </span>
                {!release.preOrder && (
                  <button
                    onClick={() => onPlayTrack(idx)}
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover/track:opacity-100 transition-opacity"
                    style={{ background: release.accentColour ?? '#F56D00' }}
                    aria-label={`Play ${track.title}`}
                  >
                    <svg width="10" height="10" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Download Modal ─────────────────────────────────────────── */

function FormatSelectorModal({
  release,
  onClose,
  showToast,
}: {
  release: LibraryRelease
  onClose: () => void
  showToast: (msg: string) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')
  const [trackDownloading, setTrackDownloading] = useState<string | null>(null)
  const isAlbum = release.tracks.length > 1

  const downloadSingleTrack = async (track: LibraryRelease['tracks'][number]) => {
    const res = await fetch(`/api/stream?trackId=${track.id}`)
    if (!res.ok) throw new Error('Failed to get stream URL')
    const { url, format: ext } = await res.json()
    if (!url) throw new Error('No URL returned')

    const a = document.createElement('a')
    a.href = url
    a.download = `${String(track.position).padStart(2, '0')} - ${track.title}.${ext || 'wav'}`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleTrackDownload = async (track: LibraryRelease['tracks'][number]) => {
    setTrackDownloading(track.id)
    try {
      await downloadSingleTrack(track)
    } catch {
      showToast('Download failed — try again')
    } finally {
      setTrackDownloading(null)
    }
  }

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      const total = release.tracks.length
      for (let i = 0; i < total; i++) {
        const track = release.tracks[i]
        setDownloadProgress(`Downloading ${i + 1} of ${total}...`)
        await downloadSingleTrack(track)
        // Small delay between downloads to avoid browser blocking
        if (i < total - 1) await new Promise(r => setTimeout(r, 800))
      }

      fetch('/api/library/download-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.releaseId,
          format: 'original',
          trackCount: release.tracks.length,
        }),
      }).catch(() => {})

      showToast(`Downloaded ${release.releaseTitle}`)
      onClose()
    } catch {
      showToast('Download failed — check your connection and try again')
    } finally {
      setDownloading(false)
      setDownloadProgress('')
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="format-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="format-modal-title" className="font-bold text-lg mb-1">{release.releaseTitle}</h3>
        <p className="text-zinc-500 text-xs mb-4">
          {release.tracks.length} {release.tracks.length === 1 ? 'track' : 'tracks'} &middot; {release.artistName}
        </p>

        <p className="text-sm text-zinc-400 mb-5">
          Files are served in the original format uploaded by the artist.
        </p>

        {isAlbum && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wide mb-2">Tracks</p>
            {release.tracks.map(track => (
              <div key={track.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-zinc-300 truncate mr-3">
                  {String(track.position).padStart(2, '0')}. {track.title}
                </span>
                <button
                  onClick={() => handleTrackDownload(track)}
                  disabled={trackDownloading === track.id || downloading}
                  className="text-xs text-orange-500 hover:text-orange-400 font-bold shrink-0 disabled:opacity-50"
                >
                  {trackDownloading === track.id ? '...' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="flex-1 bg-orange-600 text-white font-bold text-sm py-3 rounded-full hover:bg-orange-500 transition-colors disabled:opacity-50"
          >
            {downloading ? (downloadProgress || 'Downloading...') : (isAlbum ? 'Download All' : 'Download')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Wishlist Tab ────────────────────────────────────────────── */

/* ── Wishlist (Favourites) Tab ─────────────────────────────── */

function SavedTab({ items }: { items: FavouriteItem[] }) {
  const [saved, setSaved] = useState(items)

  async function remove(item: FavouriteItem) {
    const body = item.trackId ? { track_id: item.trackId } : { release_id: item.releaseId }
    const res = await fetch('/api/favourites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) setSaved(prev => prev.filter(s => s.favouriteId !== item.favouriteId))
  }

  if (saved.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 font-medium mb-2">Your wishlist is empty.</p>
        <p className="text-zinc-600 text-sm">Tap the heart on any track or release to add it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {saved.map(item => {
        const gradient = item.coverUrl ? null : generateGradient(item.artistSlug, item.releaseId || item.trackId || 'x')
        return (
          <div key={item.favouriteId} className="flex items-center gap-3 sm:gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 sm:p-4">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
              {item.coverUrl ? (
                <Image src={item.coverUrl} fill className="object-cover" sizes="56px" alt={item.releaseTitle} />
              ) : (
                <div className="w-full h-full" style={gradient ? { background: gradient.css } : undefined} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/${item.artistSlug}`} className="hover:underline">
                <p className="text-sm font-bold text-white truncate">
                  {item.type === 'track' ? item.trackTitle : item.releaseTitle}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.artistName}
                  {item.type === 'track' && item.releaseTitle && (
                    <span className="text-zinc-600"> · {item.releaseTitle}</span>
                  )}
                </p>
              </Link>
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600 flex-shrink-0">
              {item.type}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white flex-shrink-0">
              {formatPriceUtil(item.pricePence / 100, item.currency)}
            </span>
            <Link
              href={item.releaseSlug ? `/release?a=${item.artistSlug}&r=${item.releaseSlug}` : `/${item.artistSlug}`}
              className="bg-orange-600 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full hover:bg-orange-500 transition-colors flex-shrink-0"
            >
              Buy
            </Link>
            <button
              onClick={() => remove(item)}
              className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
              aria-label="Remove from saved"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function RedownloadButton({ purchaseId, onSuccess }: { purchaseId: string; onSuccess: (msg: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/library/redownload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_id: purchaseId }),
      })
      if (res.ok) {
        setDone(true)
        onSuccess('Check your email for a new download link')
      } else {
        onSuccess('Failed to request download link')
      }
    } catch {
      onSuccess('Request failed - check your connection')
    }
    setLoading(false)
  }

  if (done) {
    return <span className="text-[10px] text-green-400 font-bold">Link sent!</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-transparent ring-1 ring-orange-600/30 text-orange-500 hover:ring-orange-600/60 hover:bg-orange-600/5 transition-all shrink-0 disabled:opacity-50"
    >
      {loading ? 'Requesting...' : 'Request download link'}
    </button>
  )
}

function OrderAction({ orderId, action, label }: { orderId: string; action: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, { method: 'POST' })
      const data = await res.json()
      setResult(data.message || (res.ok ? 'Done' : data.error || 'Failed'))
    } catch {
      setResult('Request failed - check your connection')
    }
    setLoading(false)
  }

  if (result) return <span className="text-[10px] text-zinc-500">{result}</span>

  return (
    <button onClick={handleClick} disabled={loading} className="text-[10px] font-bold text-zinc-400 hover:text-orange-500 transition-colors disabled:opacity-40">
      {loading ? '...' : label}
    </button>
  )
}
