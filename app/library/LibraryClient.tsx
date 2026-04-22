'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'
import { generateGradient } from '@/lib/gradient'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import type { LibraryRelease } from './page'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'

type SortOption = 'newest' | 'oldest' | 'title' | 'artist'

interface Props {
  releases: LibraryRelease[]
  error: string | null
}

export default function LibraryClient({ releases, error }: Props) {
  const [artistFilter, setArtistFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [downloadModal, setDownloadModal] = useState<LibraryRelease | null>(null)
  const [toastText, setToastText] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const play = usePlayerStore((s) => s.play)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  // Unique artists for filter dropdown
  const uniqueArtists = useMemo(() => {
    const map = new Map<string, string>()
    releases.forEach((r) => map.set(r.artistId, r.artistName))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [releases])

  // Filter + sort
  const filtered = useMemo(() => {
    let items = [...releases]
    if (artistFilter !== 'all') {
      items = items.filter((r) => r.artistId === artistFilter)
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
  }, [releases, artistFilter, sort])

  // Stats
  const totalPence = releases.reduce((s, r) => s + r.amountPence, 0)
  const totalContributed = formatPriceUtil(totalPence / 100, 'GBP')
  const releasesOwned = releases.length
  const uniqueArtistCount = uniqueArtists.length

  // Toast
  const showToast = useCallback((msg: string) => {
    setToastText(msg)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500)
  }, [])

  // Play a release — queue all tracks
  const handlePlay = (release: LibraryRelease) => {
    const queue: PlayerTrack[] = release.tracks.map((t) => ({
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
    if (queue.length > 0) {
      play(queue[0], queue)
    }
  }

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen font-display flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <h2 className="text-xl font-bold mb-3">Something went wrong loading your library.</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Try refreshing, or contact us if it keeps happening.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-orange-600 text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-orange-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (releases.length === 0) {
    return (
      <div className="min-h-screen font-display">
        <LibraryNav />
        <div className="flex items-center justify-center min-h-[70vh] relative">
          <div className="absolute inset-0 opacity-30" style={{ background: generateGradient('empty', 'state').css }} />
          <div className="text-center relative z-10 px-8">
            <h2 className="text-3xl font-black tracking-tight mb-3">Nothing here yet.</h2>
            <p className="text-zinc-400 font-medium mb-8">Find something you love.</p>
            <Link
              href="/explore"
              className="inline-block bg-orange-600 text-white font-bold px-8 py-3.5 rounded-full text-sm hover:bg-orange-500 transition-colors"
            >
              Discover music
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-display pb-24">
      <LibraryNav />

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header + Stats */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              Your Library
            </p>
            <h1 className="text-5xl font-black tracking-tighter mb-2">My Music</h1>
            <p className="text-zinc-400 font-medium">
              You&apos;ve supported{' '}
              <span className="text-white font-bold">{uniqueArtistCount} {uniqueArtistCount === 1 ? 'artist' : 'artists'}</span>{' '}
              directly.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Total Contributed
              </p>
              <p className="text-2xl font-black text-orange-600">{totalContributed}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                Releases Owned
              </p>
              <p className="text-2xl font-black">{releasesOwned}</p>
            </div>
          </div>
        </div>

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

        {/* Releases */}
        {viewMode === 'expanded' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filtered.map((r) => (
              <ReleaseCard
                key={r.purchaseId}
                release={r}
                onPlay={() => handlePlay(r)}
                onDownload={() => setDownloadModal(r)}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((r) => (
              <ReleaseRowCompact
                key={r.purchaseId}
                release={r}
                onPlay={() => handlePlay(r)}
                onDownload={() => setDownloadModal(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Download Format Modal */}
      {downloadModal && (
        <FormatSelectorModal
          release={downloadModal}
          onClose={() => setDownloadModal(null)}
          showToast={showToast}
        />
      )}

      {/* Toast */}
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

/* ── Nav ─────────────────────────────────────────────────────── */

function LibraryNav() {
  return (
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
          Explore
        </Link>
      </div>
    </nav>
  )
}

/* ── Release Card ────────────────────────────────────────────── */

function ReleaseCard({
  release,
  onPlay,
  onDownload,
  formatDate,
}: {
  release: LibraryRelease
  onPlay: () => void
  onDownload: () => void
  formatDate: (iso: string) => string
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
      <Link
        href={`/${release.artistSlug}`}
        className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5 truncate block hover:text-orange-600 transition-colors"
      >
        {release.artistName}
      </Link>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-600 font-bold">
          {formatDate(release.purchasedAt)}
        </span>
        <span className="text-[10px] font-black text-orange-600">
          {formatPriceUtil(release.amountPence / 100, 'GBP')}
        </span>
      </div>
    </div>
  )
}

/* ── Compact Row ────────────────────────────────────────────── */

function ReleaseRowCompact({
  release,
  onPlay,
  onDownload,
}: {
  release: LibraryRelease
  onPlay: () => void
  onDownload: () => void
}) {
  const gradient = release.coverUrl ? null : generateGradient(release.artistId, release.releaseId)

  return (
    <div className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
      {/* Artwork */}
      <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
        {release.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={release.coverUrl} className="w-full h-full object-cover" loading="lazy" alt={release.releaseTitle} />
        ) : (
          <div className="w-full h-full" style={{ background: gradient?.css }} />
        )}
      </div>

      {/* Title */}
      <span className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0">
        {release.releaseTitle}
      </span>

      {/* Artist */}
      <Link
        href={`/${release.artistSlug}`}
        className="hidden md:block text-[13px] text-zinc-500 truncate w-36 flex-shrink-0 hover:text-orange-600 transition-colors"
      >
        {release.artistName}
      </Link>

      {/* Genre */}
      {release.genre && (
        <span className="hidden lg:inline-flex items-center bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0">
          {release.genre}
        </span>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Price */}
      <span className="text-[13px] font-semibold text-orange-600 flex-shrink-0">
        &pound;{(release.amountPence / 100).toFixed(2)}
      </span>

      {/* Play */}
      {!release.preOrder && (
        <button
          onClick={onPlay}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
          style={{ background: release.accentColour ?? '#ea580c' }}
          aria-label="Play"
        >
          <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Download */}
      {!release.preOrder && (
        <button
          onClick={onDownload}
          className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-transparent ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04] transition-all shrink-0"
        >
          &darr; Download
        </button>
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

  const handleDownload = async () => {
    setDownloading(true)
    localStorage.setItem('insound_dl_format', format)

    try {
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

        if (release.tracks.length > 1) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
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
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg mb-1">{release.releaseTitle}</h3>
        <p className="text-zinc-500 text-xs mb-5">
          {release.tracks.length} {release.tracks.length === 1 ? 'track' : 'tracks'} &middot; {release.artistName}
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
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
