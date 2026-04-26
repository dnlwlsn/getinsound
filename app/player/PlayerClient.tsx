'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { usePlayerStore, type Track } from '@/lib/stores/player'

const allTracks: { id: string; title: string; artist: string; artistSlug: string; price: string; img: string }[] = []

/* ── Helpers ───────────────────────────────────────────────────── */
function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function playerUrl(t: { id: string; title: string; artist: string; artistSlug: string; price: string; img: string }) {
  return `/player?id=${t.id}&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}&artistSlug=${encodeURIComponent(t.artistSlug)}&price=${t.price}&img=${encodeURIComponent(t.img)}`
}

function buildTrack(params: {
  id: string; title: string; artist: string; artistSlug: string;
  img: string; accent: string;
}): Track {
  return {
    id: params.id,
    title: params.title,
    artistName: params.artist,
    artistSlug: params.artistSlug,
    releaseId: params.id,
    releaseTitle: params.title,
    coverUrl: params.img,
    position: 1,
    durationSec: null,
    accentColour: params.accent,
    purchased: false,
  }
}

/* ── Component ─────────────────────────────────────────────────── */
export default function PlayerClient() {
  const searchParams = useSearchParams()

  /* Track data from URL params */
  const trackId = searchParams.get('id') || '0'
  const title = searchParams.get('title') || 'Untitled'
  const artist = searchParams.get('artist') || 'Unknown Artist'
  const artistSlug = searchParams.get('artistSlug') || ''
  const price = searchParams.get('price') || '5.99'
  const img = searchParams.get('img') || ''
  const accent = searchParams.get('accent') || '#F56D00'

  /* Player store */
  const play = usePlayerStore(s => s.play)
  const pause = usePlayerStore(s => s.pause)
  const resume = usePlayerStore(s => s.resume)
  const storeNext = usePlayerStore(s => s.next)
  const storePrevious = usePlayerStore(s => s.previous)
  const seek = usePlayerStore(s => s.seek)
  const setVolume = usePlayerStore(s => s.setVolume)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const currentTime = usePlayerStore(s => s.currentTime)
  const duration = usePlayerStore(s => s.duration)
  const volume = usePlayerStore(s => s.volume)
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPreview = usePlayerStore(s => s.isPreview)

  /* Local UI state */
  const [liked, setLiked] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'processing' | 'success'>('form')
  const [stickyBarVisible, setStickyBarVisible] = useState(false)
  const [stickyBarDismissed, setStickyBarDismissed] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registerEmail, setRegisterEmail] = useState('')
  const [stickyEmail, setStickyEmail] = useState('')
  const [registerSending, setRegisterSending] = useState(false)
  const [stickySending, setStickySending] = useState(false)
  const [registerEmailError, setRegisterEmailError] = useState(false)
  const [stickyEmailError, setStickyEmailError] = useState(false)

  const progressBarRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const hasStartedRef = useRef(false)

  /* Start playback on mount (or when track changes via URL) */
  useEffect(() => {
    const track = buildTrack({ id: trackId, title, artist, artistSlug, img, accent })
    const related = allTracks
      .filter(t => t.id !== trackId)
      .sort((a, b) => (a.artist === artist ? -1 : b.artist === artist ? 1 : 0))
      .slice(0, 3)
    const queue: Track[] = [
      track,
      ...related.map(t => buildTrack({ id: t.id, title: t.title, artist: t.artist, artistSlug: t.artistSlug, img: t.img, accent })),
    ]
    play(track, queue)
    hasStartedRef.current = true
  }, [trackId, title, artist, artistSlug, img, accent]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Apply accent colour as CSS variable */
  useEffect(() => {
    document.documentElement.style.setProperty('--artist-accent', accent)
  }, [accent])

  /* Update document title */
  useEffect(() => {
    document.title = `${title} — ${artist} | Insound`
  }, [title, artist])

  /* Check localStorage for prior registration */
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('insound_interested')) {
      setRegistered(true)
    }
    if (typeof window !== 'undefined' && sessionStorage.getItem('insound_bar_dismissed')) {
      setStickyBarDismissed(true)
    }
  }, [])

  /* Scroll listener for sticky bar */
  useEffect(() => {
    if (stickyBarDismissed || registered) return
    function onScroll() {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1)
      if (pct > 0.35) setStickyBarVisible(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [stickyBarDismissed, registered])

  /* Derived values */
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const isThisTrack = currentTrack?.id === trackId
  const playing = isThisTrack && isPlaying

  const related = allTracks
    .filter(t => t.id !== trackId)
    .sort((a, b) => (a.artist === artist ? -1 : b.artist === artist ? 1 : 0))
    .slice(0, 3)

  /* Handlers */
  const togglePlay = useCallback(() => {
    if (!isThisTrack) {
      const track = buildTrack({ id: trackId, title, artist, artistSlug, img, accent })
      play(track)
      return
    }
    if (isPlaying) pause()
    else resume()
  }, [isThisTrack, isPlaying, trackId, title, artist, artistSlug, img, accent, play, pause, resume])

  const seekFromX = useCallback((clientX: number) => {
    const bar = progressBarRef.current
    if (!bar || duration <= 0) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    seek(pct * duration)
  }, [duration, seek])

  const onScrubStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    scrubbingRef.current = true
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    seekFromX(clientX)

    function onMove(ev: MouseEvent | TouchEvent) {
      if (!scrubbingRef.current) return
      const x = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      seekFromX(x)
    }
    function onEnd() {
      scrubbingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
  }, [seekFromX])

  const shareTrack = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  const openBuyModal = useCallback(() => {
    setBuyModalOpen(true)
    setCheckoutStep('form')
  }, [])

  const closeBuyModal = useCallback(() => setBuyModalOpen(false), [])

  useEffect(() => {
    if (!buyModalOpen) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeBuyModal() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [buyModalOpen, closeBuyModal])

  const completePurchase = useCallback(() => {
    setCheckoutStep('processing')
    setTimeout(() => setCheckoutStep('success'), 1800)
  }, [])

  /* Register interest */
  const submitInterest = useCallback((email: string, source: 'main' | 'sticky') => {
    const isValid = /\S+@\S+\.\S+/.test(email.trim())
    if (!isValid) {
      if (source === 'main') setRegisterEmailError(true)
      else setStickyEmailError(true)
      return
    }
    if (source === 'main') setRegisterSending(true)
    else setStickySending(true)

    fetch('https://formspree.io/f/mbjergwz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.trim(), source: document.title }),
    })
      .then(r => {
        if (r.ok) {
          localStorage.setItem('insound_interested', '1')
          setRegistered(true)
        } else {
          if (source === 'main') { setRegisterSending(false); setRegisterEmailError(true) }
          else { setStickySending(false); setStickyEmailError(true) }
        }
      })
      .catch(() => {
        if (source === 'main') { setRegisterSending(false); setRegisterEmailError(true) }
        else { setStickySending(false); setStickyEmailError(true) }
      })
  }, [])

  const dismissStickyBar = useCallback(() => {
    setStickyBarDismissed(true)
    sessionStorage.setItem('insound_bar_dismissed', '1')
  }, [])

  return (
    <>
      {/* ── Inline styles for player-specific animations ────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 12s linear infinite; }
        .spin-slow.paused { animation-play-state: paused; }
        @keyframes bar { 0%, 100% { height: 4px; } 50% { height: 20px; } }
        .bar1 { animation: bar 0.8s ease-in-out infinite; }
        .bar2 { animation: bar 0.8s ease-in-out infinite 0.15s; }
        .bar3 { animation: bar 0.8s ease-in-out infinite 0.3s; }
        .bar4 { animation: bar 0.8s ease-in-out infinite 0.1s; }
        .bars-paused .bar1, .bars-paused .bar2, .bars-paused .bar3, .bars-paused .bar4 { animation-play-state: paused; }
      `}} />

      <div className="min-h-screen flex flex-col relative overflow-x-hidden">
        {/* ── Main player area ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,88,12,0.07),transparent)] pointer-events-none" />

          <div className="relative z-10 w-full max-w-sm mx-auto">
            {/* Back + share/like */}
            <div className="flex justify-between items-center mb-8">
              <Link href="/explore" className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
                Explore
              </Link>
              <div className="flex items-center gap-1">
                <button onClick={shareTrack} className="text-zinc-500 hover:text-white transition-colors p-2">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
                <button
                  onClick={() => setLiked(l => !l)}
                  className={`${liked ? 'text-red-400' : 'text-zinc-500'} hover:text-red-400 transition-colors p-2`}
                >
                  <svg width="22" height="22" fill={liked ? '#f87171' : 'none'} stroke={liked ? '#f87171' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Album art */}
            <div className="relative mb-8 group">
              <div className="aspect-square w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/60 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  className={`w-full h-full object-cover spin-slow ${playing ? '' : 'paused'}`}
                  alt="Album art"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              {/* Equaliser bars */}
              <div className={`${playing ? '' : 'bars-paused'} absolute bottom-5 right-5 flex items-end gap-1 h-6`}>
                <div className="bar1 w-1.5 bg-orange-500 rounded-full" />
                <div className="bar2 w-1.5 bg-orange-500 rounded-full" />
                <div className="bar3 w-1.5 bg-orange-500 rounded-full" />
                <div className="bar4 w-1.5 bg-orange-500 rounded-full" />
              </div>
            </div>

            {/* Track info */}
            <div className="mb-7">
              <h1 className="text-3xl font-black leading-tight mb-1 font-display">{title}</h1>
              <div className="flex items-center justify-between">
                <p className="text-orange-600 font-bold tracking-tight text-lg">{artist}</p>
                <div className="flex items-center gap-2">
                  {isPreview && isThisTrack && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-600/10 border border-orange-600/20 px-3 py-1 rounded-full">
                      Preview
                    </span>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                    Indie
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar (supports click + drag scrubbing) */}
            <div className="mb-3">
              <div
                ref={progressBarRef}
                onMouseDown={onScrubStart}
                onTouchStart={onScrubStart}
                className="w-full h-3 bg-zinc-800 rounded-full cursor-pointer relative group touch-none"
              >
                <div className="absolute inset-y-0 left-0 bg-orange-600 rounded-full" style={{ width: `${progressPct}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 group-active:scale-100 transition-transform" />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 font-bold mb-7">
              <span>{isThisTrack ? formatTime(currentTime) : '0:00'}</span>
              <span>{duration > 0 && isThisTrack ? formatTime(duration) : '--:--'}</span>
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-6 sm:gap-8 mb-8">
              <button onClick={storePrevious} className="text-zinc-400 hover:text-white transition-colors p-2">
                <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>
              <button
                onClick={togglePlay}
                className="bg-white text-black w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center hover:bg-orange-600 hover:scale-105 transition-all shadow-2xl shadow-orange-600/20"
              >
                {playing ? (
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <button onClick={storeNext} className="text-zinc-400 hover:text-white transition-colors p-2">
                <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 mb-8">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-600">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              </svg>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={e => setVolume(parseInt(e.target.value) / 100)}
                className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-orange-600"
              />
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>

            {/* Buy CTA */}
            <button
              onClick={openBuyModal}
              className="w-full bg-orange-600 text-black font-black py-5 rounded-3xl hover:bg-orange-500 transition-all text-sm uppercase tracking-wider shadow-xl shadow-orange-600/20 hover:scale-[1.01]"
            >
              Support Artist &middot; &pound;{price}
            </button>

            {/* Artist payout callout */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-zinc-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 pulse-dot flex-shrink-0" />
              We only take 10% — the rest goes to <span className="text-orange-500 font-black ml-1">{artist}</span>
            </div>
          </div>

          {/* More from this artist */}
          <div className="relative z-10 w-full max-w-sm mx-auto mt-8 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">More from this artist</p>
            <div className="space-y-2">
              {related.map(t => (
                <Link
                  key={t.id}
                  href={playerUrl(t)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.img.replace('/600/600', '/80/80')} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{t.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{t.artist}</p>
                  </div>
                  <span className="text-xs text-orange-600 font-black flex-shrink-0">&pound;{t.price}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Share toast */}
          <div
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-50 transition-all duration-300 ${
              showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            Link copied!
          </div>

          {/* ── Buy modal ───────────────────────────────────────────── */}
          {buyModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeBuyModal} />
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-8 w-full sm:max-w-sm shadow-2xl">
                {checkoutStep !== 'success' ? (
                  <div>
                    <h3 className="text-xl font-black mb-1 font-display">Support {artist}</h3>
                    <p className="text-zinc-500 text-sm mb-6">We take a flat 10%. Stripe takes their standard processing fee (1.5% + 20p), shown at checkout. The rest goes directly to the artist.</p>
                    <div className="bg-zinc-950 rounded-2xl p-5 mb-6 border border-zinc-800">
                      <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.replace('/600/600', '/100/100')} className="w-16 h-16 rounded-xl object-cover" alt="" />
                        <div>
                          <p className="font-black">{title}</p>
                          <p className="text-sm text-zinc-500 font-bold">{artist}</p>
                          <p className="text-orange-600 font-black mt-1">&pound;{price}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email for download link</label>
                        <input type="email" placeholder="name@example.com" defaultValue="dan@example.com"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 focus:border-orange-600 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Card Number</label>
                        <input type="text" placeholder="4242 4242 4242 4242"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 focus:border-orange-600 transition-colors font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Expiry</label>
                          <input type="text" placeholder="MM / YY"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 font-mono focus:border-orange-600 transition-colors" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">CVC</label>
                          <input type="text" placeholder="&bull;&bull;&bull;"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 font-mono focus:border-orange-600 transition-colors" />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={completePurchase}
                      disabled={checkoutStep === 'processing'}
                      className="w-full bg-orange-600 text-black font-black py-4 rounded-2xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-70"
                    >
                      {checkoutStep === 'processing' ? 'Processing...' : `Pay £${price}`}
                    </button>
                    <p className="text-center text-[10px] text-zinc-600 mt-4 font-bold tracking-wide">Secured by 256-bit encryption</p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-orange-600/15 rounded-full flex items-center justify-center mx-auto mb-5">
                      <svg width="32" height="32" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h3 className="text-xl font-black mb-2 font-display">You&apos;re a legend.</h3>
                    <p className="text-zinc-400 text-sm mb-1">Purchase complete.</p>
                    <p className="text-orange-600 font-black text-sm mb-6">Download link sent to your email.</p>
                    <button onClick={closeBuyModal} className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-colors text-sm">
                      Keep Listening
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Register interest ──────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-zinc-950 border-t border-zinc-900">
          <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/20 rounded-full px-4 py-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 pulse-dot" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Early Access Open</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-4 font-display">Be first in line.</h2>
            <p className="text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed text-sm sm:text-base">
              Register your interest and get priority access, a founding member badge, and your rate locked in forever — before we open to everyone.
            </p>
            {!registered ? (
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5">
                <input
                  type="email"
                  value={registerEmail}
                  onChange={e => { setRegisterEmail(e.target.value); setRegisterEmailError(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') submitInterest(registerEmail, 'main') }}
                  placeholder="your@email.com"
                  className={`flex-1 bg-zinc-900 border ${registerEmailError ? 'border-red-500' : 'border-zinc-800'} focus:border-orange-600 focus:outline-none rounded-xl px-4 py-4 text-sm font-medium text-white placeholder-zinc-600 transition-colors`}
                />
                <button
                  onClick={() => submitInterest(registerEmail, 'main')}
                  disabled={registerSending}
                  className="bg-orange-600 hover:bg-orange-500 text-black font-black px-7 py-4 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20 disabled:opacity-70"
                >
                  {registerSending ? 'Sending...' : 'Register →'}
                </button>
              </div>
            ) : (
              <div className="mb-5">
                <div className="inline-flex items-center gap-3 bg-orange-600/10 border border-orange-600/20 rounded-xl px-6 py-4">
                  <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-orange-500 font-black text-sm">You&apos;re on the list. We&apos;ll be in touch.</span>
                </div>
              </div>
            )}
            <p className="text-zinc-600 text-xs font-medium">
              No spam, ever &nbsp;&middot;&nbsp; Unsubscribe anytime &nbsp;&middot;&nbsp;{' '}
              <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
            </p>
          </div>
        </section>

        {/* ── Sticky register bar (hidden on mobile to avoid overlap) ── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-5 py-3.5 hidden sm:block"
          style={{
            transform: stickyBarVisible && !stickyBarDismissed && !registered ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-white">Get early access to Insound</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Founding member rates — locked forever</p>
            </div>
            {!registered ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={stickyEmail}
                  onChange={e => { setStickyEmail(e.target.value); setStickyEmailError(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') submitInterest(stickyEmail, 'sticky') }}
                  placeholder="your@email.com"
                  className={`w-52 bg-zinc-800 border ${stickyEmailError ? 'border-red-500' : 'border-zinc-700'} focus:border-orange-600 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors`}
                />
                <button
                  onClick={() => submitInterest(stickyEmail, 'sticky')}
                  disabled={stickySending}
                  className="bg-orange-600 hover:bg-orange-500 text-black font-black px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20 disabled:opacity-70"
                >
                  {stickySending ? 'Sending...' : 'Register →'}
                </button>
              </div>
            ) : (
              <span className="text-orange-500 font-black text-sm flex items-center gap-2">
                <svg width="14" height="14" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                You&apos;re on the list
              </span>
            )}
            <button onClick={dismissStickyBar} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0 p-1" aria-label="Dismiss">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
