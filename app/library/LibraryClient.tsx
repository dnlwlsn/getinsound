'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'
import { generateGradient } from '@/lib/gradient'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { Badge } from '@/app/components/ui/Badge'
import { VerifiedTick } from '@/app/components/ui/VerifiedTick'
import type { LibraryRelease } from './page'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'
import { getTrackingUrl } from '@/lib/carriers'
import { zipSync } from 'fflate'

type SortOption = 'newest' | 'oldest' | 'title' | 'artist'
type DateRange = 'all' | '7d' | '30d' | '90d' | '1y'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'All Time',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'Last Year',
}

export interface WishlistItem {
  wishlistId: string
  releaseId: string
  releaseSlug: string
  title: string
  type: string
  coverUrl: string | null
  pricePence: number
  currency: string
  artistName: string
  artistSlug: string
  accentColour: string | null
  savedAt: string
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
  wishlist?: WishlistItem[]
  favourites?: FavouriteItem[]
  merchOrders?: MerchOrderItem[]
}

export default function LibraryClient({ releases, error, userId, wishlist = [], favourites = [], merchOrders = [] }: Props) {
  const [tab, setTab] = useState<'collection' | 'saved' | 'wishlist' | 'orders'>('collection')
  const [artistFilter, setArtistFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [downloadModal, setDownloadModal] = useState<LibraryRelease | null>(null)
  const [toastText, setToastText] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())

  const play = usePlayerStore((s) => s.play)
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

  const primaryCurrency = releases[0]?.displayCurrency ?? 'GBP'
  const totalAmount = releases.reduce((s, r) => s + r.displayAmount, 0)
  const totalContributed = formatPriceUtil(totalAmount / 100, primaryCurrency)
  const releasesOwned = releases.length
  const uniqueArtistCount = uniqueArtists.length

  const showToast = useCallback((msg: string) => {
    setToastText(msg)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500)
  }, [])

  const buildQueue = useCallback((release: LibraryRelease): PlayerTrack[] => {
    return release.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: release.artistName,
      artistSlug: release.artistSlug,
      releaseId: release.releaseId,
      releaseTitle: release.releaseTitle,
      coverUrl: release.coverUrl,
      position: t.position,
      durationSec: t.durationSec,
      accentColour: release.accentColour,
      purchased: true,
    }))
  }, [])

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
          <h2 className="text-lg font-bold text-zinc-300 mb-2">Something went wrong loading your library.</h2>
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

  if (releases.length === 0 && favourites.length === 0 && wishlist.length === 0) {
    return (
      <div className="min-h-screen font-display">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center px-8">
            <h2 className="text-lg font-bold text-zinc-300 mb-2">Nothing here yet.</h2>
            <p className="text-zinc-500 text-sm mb-5">Find something you love.</p>
            <Link
              href="/explore"
              className="text-orange-600 text-sm font-bold hover:text-orange-500 transition-colors"
            >
              Discover music &rarr;
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-display pb-24">

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Header + Stats */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              Your Library
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
                Contributed
              </p>
              <p className="text-xl sm:text-2xl font-black text-orange-600">{totalContributed}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl text-right flex-1 md:flex-initial">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Releases
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
            onClick={() => setTab('saved')}
            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'saved' ? 'border-orange-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Saved ({favourites.length})
          </button>
          <button
            onClick={() => setTab('wishlist')}
            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'wishlist' ? 'border-orange-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Wishlist ({wishlist.length})
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

        {tab === 'saved' && (
          <SavedTab items={favourites} />
        )}

        {tab === 'wishlist' && (
          <WishlistTab items={wishlist} />
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            {merchOrders.map(o => {
              const merchData = Array.isArray(o.merch) ? o.merch[0] : o.merch
              const artistData = Array.isArray(o.artists) ? o.artists[0] : o.artists
              const photo = merchData?.photos?.[0]
              const trackingUrl = getTrackingUrl(o.carrier, o.tracking_number)
              const canReturn = o.status === 'delivered' && o.delivered_at &&
                new Date().getTime() - new Date(o.delivered_at).getTime() < 14 * 24 * 60 * 60 * 1000

              return (
                <div key={o.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                    {photo ? <img src={photo} alt={merchData?.name || 'Merch item'} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
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

        {tab === 'collection' && <>
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
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors"
            >
              {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((key) => (
                <option key={key} value={key}>{DATE_RANGE_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
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
            <ViewToggle mode={viewMode} onToggle={setViewMode} />
          </div>
        </div>

        {/* Releases — animated view transition */}
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

        {filtered.length === 0 && releases.length > 0 && (
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

      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[300] transition-all duration-300 ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {toastText}
      </div>
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
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-600 font-bold">
          {formatDate(release.purchasedAt)}
        </span>
        <span className="text-[10px] font-black text-orange-600">
          {formatPriceUtil(release.displayAmount / 100, release.displayCurrency)}
        </span>
      </div>
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
      <div className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
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

        <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
          {release.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={release.coverUrl} className="w-full h-full object-cover" loading="lazy" alt={release.releaseTitle} />
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

        <span className="text-[13px] font-semibold text-orange-600 flex-shrink-0">
          {formatPriceUtil(release.displayAmount / 100, release.displayCurrency)}
        </span>

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
                className="group/track flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-[#181818] transition-colors"
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

/* ── Format Selector Modal ───────────────────────────────────── */

type AudioFormat = 'wav' | 'flac' | 'mp3'

const FORMAT_LABELS: Record<AudioFormat, string> = {
  wav: 'WAV — Original Quality',
  flac: 'FLAC — Lossless Compressed',
  mp3: 'MP3 — 320kbps',
}

function FormatSelectorModal({
  release,
  onClose,
  showToast,
}: {
  release: LibraryRelease
  onClose: () => void
  showToast: (msg: string) => void
}) {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('insound_dl_format') : null
  const [format, setFormat] = useState<AudioFormat>((stored as AudioFormat) ?? 'wav')
  const [downloading, setDownloading] = useState(false)
  const isAlbum = release.tracks.length > 1

  const handleDownload = async () => {
    setDownloading(true)
    localStorage.setItem('insound_dl_format', format)

    try {
      if (isAlbum) {
        const files: Record<string, Uint8Array> = {}
        for (const track of release.tracks) {
          const streamRes = await fetch(`/api/stream?trackId=${track.id}`)
          if (!streamRes.ok) continue
          const { url } = await streamRes.json()
          if (!url) continue
          const audioRes = await fetch(url)
          if (!audioRes.ok) continue
          const buf = await audioRes.arrayBuffer()
          const filename = `${String(track.position).padStart(2, '0')} - ${track.title}.${format}`
          files[filename] = new Uint8Array(buf)
        }
        const zipped = zipSync(files)
        const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${release.artistName} - ${release.releaseTitle}.zip`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        for (const track of release.tracks) {
          const res = await fetch(`/api/stream?trackId=${track.id}`)
          if (!res.ok) continue
          const { url } = await res.json()
          if (!url) continue

          const a = document.createElement('a')
          a.href = url
          a.download = `${String(track.position).padStart(2, '0')} - ${track.title}.${format}`
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
      }

      fetch('/api/library/download-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.releaseId,
          format,
          trackCount: release.tracks.length,
        }),
      }).catch(() => {})

      showToast(`Downloaded ${release.releaseTitle}`)
    } catch {
      showToast('Download failed — try again')
    } finally {
      setDownloading(false)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg mb-1">{release.releaseTitle}</h3>
        <p className="text-zinc-500 text-xs mb-5">
          {release.tracks.length} {release.tracks.length === 1 ? 'track' : 'tracks'} &middot; {release.artistName}
          {isAlbum && <span className="text-zinc-600"> &middot; Downloads as ZIP</span>}
        </p>

        <div className="space-y-2 mb-6">
          {(['wav', 'flac', 'mp3'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                format === f
                  ? 'border-orange-600 bg-orange-600/10 text-white'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 bg-orange-600 text-white font-bold text-sm py-3 rounded-full hover:bg-orange-500 transition-colors disabled:opacity-50"
          >
            {downloading ? (isAlbum ? 'Zipping...' : 'Downloading...') : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Wishlist Tab ────────────────────────────────────────────── */

function WishlistTab({ items }: { items: WishlistItem[] }) {
  const [wishlist, setWishlist] = useState(items)

  async function remove(releaseId: string) {
    const res = await fetch('/api/wishlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_id: releaseId }),
    })
    if (res.ok) setWishlist(prev => prev.filter(w => w.releaseId !== releaseId))
  }

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 font-medium mb-2">Your wishlist is empty.</p>
        <p className="text-zinc-600 text-sm">Heart a release to save it for later.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {wishlist.map(w => {
        const gradient = w.coverUrl ? null : generateGradient(w.artistSlug, w.releaseId)
        return (
          <div key={w.wishlistId} className="flex items-center gap-3 sm:gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 sm:p-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
              {w.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.coverUrl} alt={w.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={gradient ? { background: gradient.css } : undefined} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/${w.artistSlug}`} className="hover:underline">
                <p className="text-sm font-bold text-white truncate">{w.title}</p>
                <p className="text-xs text-zinc-500">{w.artistName}</p>
              </Link>
            </div>
            <span className="text-xs sm:text-sm font-bold text-white flex-shrink-0">
              {formatPriceUtil(w.pricePence / 100, w.currency)}
            </span>
            <Link
              href={`/${w.artistSlug}`}
              className="bg-orange-600 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full hover:bg-orange-500 transition-colors flex-shrink-0"
            >
              Buy
            </Link>
            <button
              onClick={() => remove(w.releaseId)}
              className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 hidden sm:block"
              aria-label="Remove from wishlist"
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

/* ── Saved (Favourites) Tab ─────────────────────────────────── */

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
        <p className="text-zinc-400 font-medium mb-2">You haven&apos;t saved any tracks yet.</p>
        <p className="text-zinc-600 text-sm">Tap the heart on any track to save it for later.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {saved.map(item => {
        const gradient = item.coverUrl ? null : generateGradient(item.artistSlug, item.releaseId || item.trackId || 'x')
        return (
          <div key={item.favouriteId} className="flex items-center gap-3 sm:gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 sm:p-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverUrl} alt={item.releaseTitle} className="w-full h-full object-cover" />
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
              className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 hidden sm:block"
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
      onSuccess('Something went wrong')
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
      setResult('Something went wrong')
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
