'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/lib/stores/player'
import { setAccentVar, resolveAccent } from '@/lib/accent'
import { FavouriteButton } from '@/app/components/ui/FavouriteButton'

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMuted,
    audioUrl, isPreview, previewDuration, isExpanded,
    pause, resume, next, previous, seek,
    setVolume, toggleMute, setCurrentTime, setDuration, setAudioUrl,
    setIsPlaying, toggleExpanded,
  } = usePlayerStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const fetchingRef = useRef<string | null>(null)
  const playLoggedRef = useRef<string | null>(null)

  // Log play count helper (fires once per track play)
  const logPlay = useCallback((trackId: string, preview: boolean) => {
    const key = `${trackId}-${preview}`
    if (playLoggedRef.current === key) return
    playLoggedRef.current = key
    fetch('/api/tracks/log-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, isPreview: preview }),
    }).catch(() => {})
  }, [])

  // Reset play-logged flag when track changes
  useEffect(() => {
    playLoggedRef.current = null
  }, [currentTrack?.id])

  // Fetch signed URL when track changes
  useEffect(() => {
    if (!currentTrack) return
    if (fetchingRef.current === currentTrack.id) return
    fetchingRef.current = currentTrack.id

    fetch(`/api/stream?trackId=${currentTrack.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          setAudioUrl(data.url, data.isPreview, data.previewDuration ?? null)
        }
      })
      .catch(() => {
        fetchingRef.current = null
      })
  }, [currentTrack, setAudioUrl])

  // Apply artist accent colour
  useEffect(() => {
    if (currentTrack) {
      setAccentVar(currentTrack.accentColour)
    }
  }, [currentTrack])

  // Sync audio element with state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    if (audio.src !== audioUrl) {
      audio.src = audioUrl
      audio.load()
    }

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [audioUrl, isPlaying, setIsPlaying])

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Seek sync
  const lastSeek = useRef(currentTime)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    // Only seek if the store time jumped (user dragged scrubber)
    if (Math.abs(currentTime - lastSeek.current) > 1) {
      audio.currentTime = currentTime
    }
    lastSeek.current = currentTime
  }, [currentTime])

  // Effective duration for display — use preview limit when applicable
  const displayDuration = previewDuration && isPreview ? Math.min(previewDuration, duration) : duration

  // Waveform drawing
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const barCount = Math.floor(w / 3)
    const effectiveDur = previewDuration && isPreview ? Math.min(previewDuration, duration) : duration
    const progress = effectiveDur > 0 ? currentTime / effectiveDur : 0
    const accent = resolveAccent(currentTrack?.accentColour)

    ctx.clearRect(0, 0, w, h)

    for (let i = 0; i < barCount; i++) {
      // Deterministic pseudo-random heights based on track id + bar index
      const seed = currentTrack ? hashCode(currentTrack.id + i) : i * 7
      const barH = (Math.abs(seed % 80) / 100) * h * 0.8 + h * 0.1

      const x = i * 3
      const filled = i / barCount <= progress

      ctx.fillStyle = filled ? accent : 'rgba(255,255,255,0.12)'
      ctx.fillRect(x, (h - barH) / 2, 2, barH)
    }
  }, [currentTime, duration, currentTrack, previewDuration, isPreview])

  // Enforce preview duration limit — stop playback and advance to next track
  const previewEnforcedRef = useRef(false)
  useEffect(() => {
    // Reset enforcement flag when track changes
    previewEnforcedRef.current = false
  }, [currentTrack?.id])

  // Animation loop for time updates
  useEffect(() => {
    const audio = audioRef.current
    const trackId = currentTrack?.id
    const preview = isPreview

    function tick() {
      if (audio && !audio.paused) {
        const t = audio.currentTime
        lastSeek.current = t
        setCurrentTime(t)

        // Log preview play at 30 seconds
        if (preview && trackId && t >= 30) {
          logPlay(trackId, true)
        }

        // Enforce preview duration limit
        if (previewDuration && t >= previewDuration && !previewEnforcedRef.current) {
          previewEnforcedRef.current = true
          if (trackId) logPlay(trackId, true)
          audio.pause()
          next()
        }
      }
      drawWaveform()
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawWaveform, setCurrentTime, previewDuration, next, currentTrack?.id, isPreview, logPlay])

  // Audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [setDuration])

  const handleEnded = useCallback(() => {
    if (currentTrack) {
      logPlay(currentTrack.id, isPreview)
    }
    next()
  }, [next, currentTrack, isPreview, logPlay])

  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || displayDuration <= 0) return
    const rect = canvas.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seek(ratio * displayDuration)
  }, [displayDuration, seek])

  const expandedRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef({ startY: 0, startTime: 0, dragging: false })
  const draggedRef = useRef(false)

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = { startY: e.touches[0].clientY, startTime: Date.now(), dragging: false }
    if (expandedRef.current) expandedRef.current.style.transition = 'none'
  }, [])

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchRef.current.startY
    if (dy > 10) {
      touchRef.current.dragging = true
      draggedRef.current = true
      if (expandedRef.current) expandedRef.current.style.transform = `translateY(${dy}px)`
    }
  }, [])

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.dragging) {
      if (expandedRef.current) {
        expandedRef.current.style.transform = ''
        expandedRef.current.style.transition = ''
      }
      return
    }
    const dy = e.changedTouches[0].clientY - touchRef.current.startY
    const elapsed = Date.now() - touchRef.current.startTime
    const velocity = elapsed > 0 ? dy / elapsed : 0
    if (expandedRef.current) expandedRef.current.style.transition = 'transform 0.2s ease-out'
    if (dy > 100 || velocity > 0.5) {
      if (expandedRef.current) expandedRef.current.style.transform = 'translateY(100%)'
      setTimeout(() => {
        toggleExpanded()
        if (expandedRef.current) {
          expandedRef.current.style.transform = ''
          expandedRef.current.style.transition = ''
        }
      }, 200)
    } else {
      if (expandedRef.current) expandedRef.current.style.transform = 'translateY(0)'
      setTimeout(() => {
        if (expandedRef.current) {
          expandedRef.current.style.transform = ''
          expandedRef.current.style.transition = ''
        }
      }, 200)
    }
    touchRef.current.dragging = false
    setTimeout(() => { draggedRef.current = false }, 50)
  }, [toggleExpanded])

  const handleHandleClick = useCallback(() => {
    if (draggedRef.current) return
    toggleExpanded()
  }, [toggleExpanded])

  if (!currentTrack) return null

  const accent = resolveAccent(currentTrack.accentColour)

  return (
    <>
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="auto"
      />

      {/* Desktop player bar */}
      <div className="player-bar-active fixed bottom-0 left-0 right-0 z-40 hidden sm:block">
        <div
          className="border-t border-white/[0.06] backdrop-blur-xl"
          style={{ background: 'rgba(10,10,10,0.95)' }}
        >
          <div className="max-w-screen-xl mx-auto px-4 h-20 flex items-center gap-4">
            {/* Track info */}
            <div className="flex items-center gap-3 w-56 min-w-0">
              {currentTrack.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={`${currentTrack.title} by ${currentTrack.artistName}`}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex-shrink-0"
                  style={{ background: accent }}
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {currentTrack.artistName}
                </p>
                {isPreview && (
                  <span className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: accent }}>
                    Preview
                  </span>
                )}
              </div>
              <FavouriteButton trackId={currentTrack.id} size={16} />
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center flex-1 gap-1">
              <div className="flex items-center gap-4">
                <button
                  onClick={previous}
                  className="text-zinc-400 hover:text-white transition-colors"
                  aria-label="Previous"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                  </svg>
                </button>

                <button
                  onClick={isPlaying ? pause : resume}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                  style={{ background: accent }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#09090b">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#09090b">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={next}
                  className="text-zinc-400 hover:text-white transition-colors"
                  aria-label="Next"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              </div>

              {/* Waveform scrubber */}
              <div className="flex items-center gap-2 w-full max-w-lg">
                <span className="text-[10px] text-zinc-500 w-8 text-right tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <canvas
                  ref={canvasRef}
                  className="flex-1 h-8 cursor-pointer"
                  onClick={handleScrubberClick}
                />
                <span className="text-[10px] text-zinc-500 w-8 tabular-nums">
                  {formatTime(displayDuration)}
                </span>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 w-36">
              <button
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  {isMuted || volume === 0 ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : volume < 0.5 ? (
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  )}
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="player-vol w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${accent} ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) ${(isMuted ? 0 : volume) * 100}%)`,
                }}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile player bar */}
      <div className="player-bar-active fixed bottom-[60px] left-0 right-0 z-40 sm:hidden">
        <div
          className="border-t border-white/[0.06] backdrop-blur-xl"
          style={{ background: 'rgba(10,10,10,0.95)' }}
        >
          {/* Progress bar (thin line at top) */}
          <div className="h-0.5 w-full bg-white/[0.06]">
            <div
              className="h-full transition-[width] duration-200"
              style={{
                width: `${displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}%`,
                background: accent,
              }}
            />
          </div>

          {isExpanded ? (
            /* Expanded mobile view */
            <div
              ref={expandedRef}
              className="px-4 py-4"
              style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            >
              <button
                onClick={handleHandleClick}
                className="w-full flex justify-center mb-4"
                aria-label="Collapse player"
              >
                <div className="w-8 h-1 rounded-full bg-zinc-700" />
              </button>

              <div className="flex flex-col items-center gap-4">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={`${currentTrack.title} by ${currentTrack.artistName}`}
                    className="w-48 h-48 rounded-2xl object-cover"
                  />
                ) : (
                  <div
                    className="w-48 h-48 rounded-2xl"
                    style={{ background: accent }}
                  />
                )}

                <div className="text-center">
                  <p className="text-base font-semibold text-white">{currentTrack.title}</p>
                  <p className="text-sm text-zinc-400">{currentTrack.artistName}</p>
                  {isPreview && (
                    <span className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: accent }}>
                      Preview
                    </span>
                  )}
                  <div className="mt-2">
                    <FavouriteButton trackId={currentTrack.id} size={20} />
                  </div>
                </div>

                {/* Scrubber */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[10px] text-zinc-500 w-8 text-right tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <canvas
                    ref={canvasRef}
                    className="flex-1 h-10 cursor-pointer"
                    onClick={handleScrubberClick}
                  />
                  <span className="text-[10px] text-zinc-500 w-8 tabular-nums">
                    {formatTime(displayDuration)}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-8">
                  <button onClick={previous} className="text-zinc-400 hover:text-white" aria-label="Previous">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                    </svg>
                  </button>
                  <button
                    onClick={isPlaying ? pause : resume}
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: accent }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#09090b">
                        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#09090b">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <button onClick={next} className="text-zinc-400 hover:text-white" aria-label="Next">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed mobile view */
            <div
              role="button"
              tabIndex={0}
              onClick={toggleExpanded}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded() } }}
              className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer"
            >
              {currentTrack.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={`${currentTrack.title} by ${currentTrack.artistName}`}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0"
                  style={{ background: accent }}
                />
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-zinc-400 truncate">{currentTrack.artistName}</p>
              </div>
              <span className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                <FavouriteButton trackId={currentTrack.id} size={16} />
              </span>
              <button
                className="flex-shrink-0 mr-1"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={e => {
                  e.stopPropagation()
                  isPlaying ? pause() : resume()
                }}
              >
                {isPlaying ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/** Simple string hash for deterministic waveform bars */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}
