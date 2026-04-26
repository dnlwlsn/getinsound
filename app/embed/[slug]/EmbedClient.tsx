'use client'

import { useState, useRef, useCallback } from 'react'

type Track = { id: string; title: string; durationSec: number | null }

type Props = {
  release: {
    slug: string
    title: string
    type: string
    coverUrl: string | null
    pricePence: number
    currency: string
  }
  artist: { slug: string; name: string; accentColour: string | null }
  tracks: Track[]
}

function formatDuration(sec: number | null): string {
  if (!sec) return '--:--'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPrice(pence: number, currency: string): string {
  const amount = pence / 100
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  } catch {
    return `£${amount.toFixed(2)}`
  }
}

export function EmbedClient({ release, artist, tracks }: Props) {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const accent = artist.accentColour || '#F56D00'
  const releaseUrl = `https://getinsound.com/release?a=${artist.slug}&r=${release.slug}`
  const coverSrc = release.coverUrl || `https://getinsound.com/favicon.svg`

  const playTrack = useCallback(async (trackId: string) => {
    // If clicking the same track, toggle play/pause
    if (playingTrackId === trackId && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
      return
    }

    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setLoading(true)
    setPlayingTrackId(trackId)

    try {
      const res = await fetch(`/api/stream?trackId=${trackId}`)
      const data = await res.json()
      if (!data.url) { setLoading(false); return }

      const audio = new Audio(data.url)
      audioRef.current = audio

      audio.addEventListener('canplay', () => {
        setLoading(false)
        setIsPlaying(true)
        audio.play()
      }, { once: true })

      // Stop after 30 seconds for preview
      if (data.isPreview && data.previewDuration) {
        setTimeout(() => {
          if (audioRef.current === audio) {
            audio.pause()
            setIsPlaying(false)
          }
        }, data.previewDuration * 1000)
      }

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setPlayingTrackId(null)
      })

      audio.addEventListener('error', () => {
        setLoading(false)
        setIsPlaying(false)
        setPlayingTrackId(null)
      })

      audio.load()
    } catch {
      setLoading(false)
      setIsPlaying(false)
      setPlayingTrackId(null)
    }
  }, [playingTrackId, isPlaying])

  const togglePlay = useCallback(() => {
    if (tracks.length === 0) return
    if (playingTrackId) {
      playTrack(playingTrackId)
    } else {
      playTrack(tracks[0].id)
    }
  }, [playingTrackId, playTrack, tracks])

  return (
    <div className="w-full max-w-[400px] h-[200px] bg-[#09090b] rounded-xl overflow-hidden flex font-[var(--font-montserrat)] relative border border-zinc-800/60">
      {/* Album art + play overlay */}
      <div className="relative w-[120px] h-[200px] shrink-0">
        <img
          src={coverSrc}
          alt={release.title}
          className="w-full h-full object-cover rounded-l-xl"
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors group"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5 text-black" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="black">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="black">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 p-3">
        {/* Release info */}
        <div className="mb-2">
          <p className="text-[11px] font-bold text-zinc-400 truncate">{artist.name}</p>
          <p className="text-sm font-bold truncate leading-tight">{release.title}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {formatPrice(release.pricePence, release.currency)}
          </p>
        </div>

        {/* Mini tracklist */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 scrollbar-thin">
          {tracks.map((t, i) => {
            const active = playingTrackId === t.id
            return (
              <button
                key={t.id}
                onClick={() => playTrack(t.id)}
                className={`w-full flex items-center gap-2 py-1 px-1.5 rounded text-left hover:bg-zinc-800/60 transition-colors ${active ? 'bg-zinc-800/40' : ''}`}
              >
                <span
                  className="text-[10px] w-4 text-right shrink-0 font-bold"
                  style={{ color: active ? accent : '#71717a' }}
                >
                  {active && isPlaying ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill={accent} className="inline">
                      <rect x="1" y="1" width="3" height="8" rx="0.5" />
                      <rect x="6" y="1" width="3" height="8" rx="0.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`text-[11px] truncate flex-1 ${active ? 'text-white font-bold' : 'text-zinc-300'}`}>
                  {t.title}
                </span>
                <span className="text-[10px] text-zinc-600 shrink-0">{formatDuration(t.durationSec)}</span>
              </button>
            )
          })}
        </div>

        {/* Buy button */}
        <a
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold text-black transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          Buy on insound.
        </a>

        {/* Attribution */}
        <p className="text-[8px] text-zinc-600 text-right mt-1 leading-none">insound.</p>
      </div>
    </div>
  )
}
