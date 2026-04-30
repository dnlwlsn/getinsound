'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { stripePromise } from '@/lib/stripe'
import { calculateFeesPence } from '@/app/lib/fees'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '../providers/CurrencyProvider'
import { FavouriteButton } from '@/app/components/ui/FavouriteButton'
import { AddToBasketButton } from '@/app/components/ui/AddToBasketButton'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'
import { resolveAccent } from '@/lib/accent'
import { extractDominantColor, hexToRgba } from '@/lib/color-extract'

/* ── Deterministic gradient fallback ──────────────────────────── */
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function seededRand(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

function hslHex(h: number, s: number, l: number) {
  const d = l / 100, a = (s * Math.min(d, 1 - d)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (d - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function generateGradientDataUri(artistId: string, releaseId: string) {
  const hash = cyrb53(`${artistId}:${releaseId}`)
  const r = seededRand(hash)
  const h1 = Math.floor(r() * 360), off = 40 + Math.floor(r() * 80), h2 = (h1 + off) % 360
  const c1 = hslHex(h1, 60 + Math.floor(r() * 30), 35 + Math.floor(r() * 20))
  const c2 = hslHex(h2, 60 + Math.floor(r() * 30), 35 + Math.floor(r() * 20))
  const cols = [c1, c2]
  if (r() < 0.4) cols.push(hslHex((h1 + off * 2) % 360, 60 + Math.floor(r() * 30), 35 + Math.floor(r() * 20)))
  const angles = [0, 45, 90, 135, 180, 225, 270, 315]
  const angle = angles[Math.floor(r() * angles.length)]
  const rad = (angle * Math.PI) / 180
  const x1 = Math.round((50 - 50 * Math.cos(rad)) * 100) / 100
  const y1 = Math.round((50 - 50 * Math.sin(rad)) * 100) / 100
  const x2 = Math.round((50 + 50 * Math.cos(rad)) * 100) / 100
  const y2 = Math.round((50 + 50 * Math.sin(rad)) * 100) / 100
  const stops = cols.map((c, i) => `<stop offset="${cols.length === 2 ? (i * 100) : (i * 50)}%" stop-color="${c}"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><defs><linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="1200" height="1200" fill="url(#g)"/><rect width="1200" height="1200" filter="url(#n)" opacity="0.05"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ── Types ────────────────────────────────────────────────────── */
interface Track { id: string; title: string; position: number; duration_sec: number }
interface Release { id: string; slug: string; title: string; type: string; cover_url: string | null; price_pence: number; currency: string; published: boolean; pwyw_enabled: boolean; pwyw_minimum_pence: number | null; description: string | null; tracks: Track[] }
interface Artist { id: string; slug: string; name: string; bio: string; avatar_url: string; accent_colour: string | null }
interface DiscographyItem { id: string; slug: string; title: string; type: string; cover_url: string | null; artistSlug: string }
interface Supporter { name: string; paidAt: string | null }
interface Recommendation { id: string; slug: string; title: string; cover_url: string | null; price_pence: number; currency: string; artistName: string; artistSlug: string }

type Stage = 'checkout' | 'preparing' | 'consent' | 'download' | 'preorder-confirmed' | 'error'


export default function ReleaseClient({ artist, release, discography, supporters, recommendations, isOwned = false }: { artist: Artist; release: Release; discography: DiscographyItem[]; supporters: Supporter[]; recommendations: Recommendation[]; isOwned?: boolean }) {
  // Set accent colour CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--artist-accent', artist.accent_colour || '#F56D00')
  }, [artist.accent_colour])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('checkout')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadTracks, setDownloadTracks] = useState<{ title: string; url?: string }[]>([])
  const [downloadTitle, setDownloadTitle] = useState('')
  const [digitalConsent, setDigitalConsent] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const sessionIdRef = useRef<string | null>(null)

  const stripeMountRef = useRef<HTMLDivElement>(null)
  const embeddedCheckoutRef = useRef<any>(null)

  const closeModal = useCallback(() => {
    setModalOpen(false)
    document.body.style.overflow = ''
    if (embeddedCheckoutRef.current) {
      try { embeddedCheckoutRef.current.destroy() } catch {}
      embeddedCheckoutRef.current = null
    }
    if (stripeMountRef.current) stripeMountRef.current.innerHTML = ''
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [modalOpen, closeModal])

  const openCheckout = useCallback(async (customAmountPence?: number) => {
    if (!release || !artist) return
    setStage('checkout')
    setModalOpen(true)
    document.body.style.overflow = 'hidden'

    try {
      const stripe = await stripePromise as any
      if (!stripe) throw new Error('Failed to load payment system.')
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('checkout-create', {
        body: {
          release_id: release.id,
          origin: window.location.origin,
          ...(customAmountPence ? { custom_amount: customAmountPence } : {}),
        },
      })
      if (error) {
        if (data?.error === 'You already own this release.') {
          setErrorTitle('Already purchased')
          setErrorMsg('This release is in your collection.')
          setStage('error')
          return
        }
        throw error
      }
      if (!data?.client_secret) throw new Error('No checkout session returned')

      sessionIdRef.current = data.session_id
      supabase.functions.invoke('record-digital-consent', {
        body: { session_id: data.session_id },
      }).catch(() => {})
      const embedded = await stripe.initEmbeddedCheckout({
        clientSecret: data.client_secret,
        onComplete: () => {
          setStage('preparing')
          pollForDownload(data.session_id)
        },
      })
      embeddedCheckoutRef.current = embedded

      // Wait a tick for the mount div to be in the DOM
      requestAnimationFrame(() => {
        if (stripeMountRef.current) embedded.mount(stripeMountRef.current)
      })
    } catch (err: any) {
      setErrorTitle("Couldn't open checkout.")
      setErrorMsg(err.message || 'Please try again.')
      setStage('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release, artist])

  async function pollForDownload(sessionId: string) {
    const supabase = createClient()
    const maxAttempts = 12
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('download', {
          body: { session_id: sessionId },
        })
        if (data && data.release) {
          setDownloadTitle(data.release.title)
          setDownloadTracks(data.tracks)
          setStage('download')
          return
        }
        let body: any = null
        try { body = await error?.context?.response?.json?.() } catch {}
        if (body?.release_date && body?.error) {
          // Pre-order: downloads not yet available
          setErrorTitle('Pre-order confirmed!')
          setErrorMsg(body.error)
          setStage('preorder-confirmed')
          return
        }
        if (body && body.error !== 'pending') throw new Error(body.error || 'Could not load download')
      } catch (err) {
        if (i === maxAttempts - 1) {
          setErrorTitle('Still finalising...')
          setErrorMsg("Your payment went through but the download isn't ready. Refresh this page in a moment.")
          setStage('error')
          return
        }
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setErrorTitle('Still finalising...')
    setErrorMsg("Your payment went through but the download isn't ready. Refresh this page in a moment.")
    setStage('error')
  }

  const tracks = [...release.tracks].sort((a, b) => a.position - b.position)
  const effectiveType = release.type === 'album' && tracks.length === 1 ? 'single' : release.type
  const typeLabel = { single: 'Single', ep: 'EP', album: 'Album' }[effectiveType] || 'Release'
  const coverSrc = release.cover_url || generateGradientDataUri(artist.id, release.id)
  const accent = resolveAccent(artist.accent_colour)

  return (
    <>
      <ReleasePageContent
        artist={artist}
        release={release}
        tracks={tracks}
        typeLabel={typeLabel}
        coverSrc={coverSrc}
        accent={accent}
        openCheckout={openCheckout}
        discography={discography}
        supporters={supporters}
        recommendations={recommendations}
        isOwned={isOwned}
      />


      {/* Checkout / Download Panel — slides from right */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="absolute top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-y-auto animate-[slide-in-right_0.3s_ease_both]">
            <button
              onClick={closeModal}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors shadow-lg"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>

            {/* Stage: Stripe checkout */}
            {stage === 'checkout' && (
              <div>
                <div ref={stripeMountRef} className="min-h-[400px]" />
                <p className="text-[10px] text-zinc-600 px-6 pb-4 leading-relaxed">
                  By completing this purchase, you agree to receive immediate access to digital content and waive your 14-day cancellation right once the download begins. See our{' '}
                  <Link href="/terms" className="underline hover:text-zinc-400">Terms</Link>.
                </p>
              </div>
            )}

            {/* Stage: Preparing */}
            {stage === 'preparing' && (
              <div className="p-12 text-center mt-20">
                <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Finalising</p>
                <h2 className="text-xl font-black mb-2 font-display">Preparing your download...</h2>
                <p className="text-zinc-500 text-sm font-medium">This usually takes a few seconds.</p>
              </div>
            )}

            {/* Stage: Digital content consent */}
            {stage === 'consent' && (
              <div className="p-6 md:p-8 mt-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received — thank you</p>
                <h2 className="text-2xl font-black mb-4 font-display">{downloadTitle}</h2>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-6">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={digitalConsent}
                      onChange={e => setDigitalConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                    />
                    <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                      I agree to immediate access to this digital content and acknowledge that I lose my 14-day cancellation right once the download starts.
                    </span>
                  </label>
                </div>
                <button
                  onClick={async () => {
                    if (!digitalConsent) return
                    setConsentBusy(true)
                    try {
                      if (sessionIdRef.current) {
                        const sb = createClient()
                        await sb.functions.invoke('record-digital-consent', {
                          body: { session_id: sessionIdRef.current },
                        })
                      }
                    } catch {}
                    setConsentBusy(false)
                    setStage('download')
                  }}
                  disabled={!digitalConsent || consentBusy}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {consentBusy ? 'Processing...' : 'Access my download'}
                </button>
              </div>
            )}

            {/* Stage: Download ready */}
            {stage === 'download' && (
              <div className="p-6 md:p-8 mt-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received — thank you</p>
                <h2 className="text-2xl font-black mb-6 font-display">{downloadTitle}</h2>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Your files</p>
                  <ol className="space-y-1">
                    {downloadTracks.map((t, i) => (
                      <li key={i} className="flex items-center gap-4 py-3 border-b border-zinc-800 last:border-0">
                        <span className="text-zinc-600 font-mono text-xs w-6">{String(i + 1).padStart(2, '0')}</span>
                        <span className="font-bold text-sm flex-1 truncate">{t.title}</span>
                        {t.url ? (
                          <a href={t.url} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-colors">Download</a>
                        ) : (
                          <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">Unavailable</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="text-center mt-6">
                  <a href={`/library?play=${release.id}`} className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3.5 rounded-xl text-sm uppercase tracking-wider transition-colors">
                    Go to My Collection →
                  </a>
                  <p className="text-[11px] text-zinc-600 font-medium mt-3">You can always re-download from your collection.</p>
                </div>
              </div>
            )}

            {/* Stage: Pre-order confirmed */}
            {stage === 'preorder-confirmed' && (
              <div className="p-12 text-center mt-20">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received — thank you</p>
                <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
                <p className="text-zinc-400 text-sm font-medium mb-6">{errorMsg}</p>
                <button onClick={closeModal} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Close</button>
              </div>
            )}

            {/* Stage: Error */}
            {stage === 'error' && (
              <div className="p-12 text-center mt-20">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Something&apos;s off</p>
                <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
                <p className="text-zinc-500 text-sm font-medium mb-6">{errorMsg}</p>
                <button onClick={closeModal} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Release page content ────────────────────────────────────── */

function ReleasePageContent({ artist, release, tracks, typeLabel, coverSrc, accent, openCheckout, discography, supporters, recommendations, isOwned }: {
  artist: Artist; release: Release; tracks: Track[]; typeLabel: string; coverSrc: string; accent: string
  openCheckout: (customAmountPence?: number) => void
  discography: DiscographyItem[]; supporters: Supporter[]; recommendations: Recommendation[]
  isOwned: boolean
}) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [ownedDismissed, setOwnedDismissed] = useState(false)
  const [albumColor, setAlbumColor] = useState<string | null>(null)
  const [showStickyBuy, setShowStickyBuy] = useState(false)
  const [pwywAmountPence, setPwywAmountPence] = useState<number | undefined>(undefined)
  const buyRef = useRef<HTMLDivElement>(null)
  const play = usePlayerStore(s => s.play)
  const hasActivePlayer = usePlayerStore(s => !!s.currentTrack)
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const pause = usePlayerStore(s => s.pause)
  const resume = usePlayerStore(s => s.resume)

  useEffect(() => {
    if (release.cover_url) {
      extractDominantColor(release.cover_url).then(setAlbumColor)
    }
  }, [release.cover_url])

  useEffect(() => {
    if (!buyRef.current) return
    const obs = new IntersectionObserver(([e]) => setShowStickyBuy(!e.isIntersecting), { threshold: 0 })
    obs.observe(buyRef.current)
    return () => obs.disconnect()
  }, [])

  const handleToggleTrack = useCallback((track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      isPlaying ? pause() : resume()
    } else {
      const queue: PlayerTrack[] = tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: artist.name,
        artistSlug: artist.slug,
        releaseId: release.id,
        releaseSlug: release.slug,
        releaseTitle: release.title,
        coverUrl: release.cover_url,
        position: t.position,
        durationSec: t.duration_sec,
        accentColour: artist.accent_colour,
        purchased: false,
      }))
      play(queue[index], queue)
    }
  }, [currentTrack, isPlaying, pause, resume, play, tracks, artist, release])

  const searchParams = useSearchParams()
  const autoplayDone = useRef(false)
  useEffect(() => {
    if (autoplayDone.current || searchParams.get('autoplay') !== 'true' || tracks.length === 0) return
    autoplayDone.current = true
    handleToggleTrack(tracks[0], 0)
  }, [searchParams, tracks, handleToggleTrack])

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <main className="flex-1 relative pb-40">
      <div
        className="absolute inset-0 pointer-events-none album-color-wash"
        style={{ background: `radial-gradient(ellipse at top, ${hexToRgba(albumColor || accent, 0.12)}, transparent 60%)` }}
      />

      <article className="max-w-4xl mx-auto px-6 md:px-12 py-10 md:py-14">
        <div className="flex flex-col sm:flex-row gap-8 md:gap-10 items-start">
          {/* Cover — constrained size */}
          <div className="w-full max-w-[280px] mx-auto sm:mx-0 sm:w-56 md:w-64 shrink-0">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
              <Image src={coverSrc} fill className="object-cover" sizes="(min-width: 768px) 256px, (min-width: 640px) 224px, 160px" alt={`${release.title} cover art`} priority />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <Link href={`/${artist.slug}`} className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity" style={{ color: accent }}>
              {artist.name}
            </Link>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2 mb-1.5 font-display">{release.title}</h1>
            <p className="text-zinc-500 text-sm mb-6">{typeLabel} · {tracks.length} track{tracks.length === 1 ? '' : 's'}</p>

            {isOwned && !ownedDismissed && (
              <div className="mb-4 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-orange-600 text-sm mt-0.5 shrink-0">✓</span>
                <p className="text-sm text-zinc-300 flex-1">
                  You already own this release — you can find it in your{' '}
                  <Link href="/library" className="text-orange-500 hover:text-orange-400 font-bold">Collection</Link>.
                  {' '}Dismiss this if you want to purchase it again.
                </p>
                <button
                  onClick={() => setOwnedDismissed(true)}
                  className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div ref={buyRef}>
              <PriceSection release={release} accent={accent} onBuy={(customAmountPence) => openCheckout(customAmountPence)} onAmountChange={setPwywAmountPence} />
            </div>

            <div className="flex items-center gap-3 mt-4">
              <FavouriteButton releaseId={release.id} size={20} />
              <button
                onClick={() => {
                  const url = window.location.href
                  if (navigator.share) {
                    navigator.share({ title: `${release.title} by ${artist.name}`, url })
                  } else {
                    navigator.clipboard.writeText(url)
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                aria-label="Share"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                </svg>
                Share
              </button>
              <AddToBasketButton
                item={{
                  type: 'release',
                  releaseId: release.id,
                  releaseTitle: release.title,
                  releaseSlug: release.slug,
                  artistId: artist.id,
                  artistName: artist.name,
                  artistSlug: artist.slug,
                  coverUrl: release.cover_url,
                  pricePence: release.price_pence,
                  currency: release.currency || 'GBP',
                  accentColour: artist.accent_colour,
                  pwyw: release.pwyw_enabled,
                  pwywMinimumPence: release.pwyw_minimum_pence ?? undefined,
                }}
                size={16}
                variant="pill"
              />
            </div>
          </div>
        </div>

        {/* Tracklist */}
        <div className="mt-10 border-t border-zinc-800 pt-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Tracklist</p>
          <ol>
            {tracks.map((t, i) => {
              const isActive = currentTrack?.id === t.id
              const isTrackPlaying = isActive && isPlaying

              return (
                <li key={t.id} className="group/track">
                  <button
                    onClick={() => handleToggleTrack(t, i)}
                    className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-left ${isActive ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40'}`}
                  >
                    <span className="w-6 text-center shrink-0 relative">
                      {isTrackPlaying ? (
                        <span className="inline-flex gap-[2px] items-end h-3">
                          <span className="w-[3px] h-full rounded-full animate-pulse" style={{ background: accent }} />
                          <span className="w-[3px] h-2/3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '150ms' }} />
                          <span className="w-[3px] h-1/3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '300ms' }} />
                        </span>
                      ) : isActive ? (
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ color: accent }}>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <>
                          <span className="text-zinc-600 font-mono text-xs group-hover/track:opacity-0">{String(i + 1).padStart(2, '0')}</span>
                          <svg className="absolute inset-0 m-auto opacity-0 group-hover/track:opacity-100 transition-opacity" width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ color: accent }}>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </>
                      )}
                    </span>
                    <span className={`font-bold text-sm flex-1 truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>{t.title}</span>
                    {t.duration_sec > 0 && (
                      <span className="text-zinc-600 text-xs font-mono shrink-0">{formatDuration(t.duration_sec)}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Credits */}
        {release.description && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Credits</p>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{release.description}</p>
          </div>
        )}

        {/* Supported by */}
        {supporters.length > 0 && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Supported by</p>
            <div className="flex flex-wrap gap-2">
              {supporters.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-zinc-900 ring-1 ring-white/[0.06] rounded-full px-3 py-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black uppercase" style={{ background: accent, color: '#000' }}>
                    {s.name.charAt(0)}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">{s.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Discography */}
        {discography.length > 0 && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">More by {artist.name}</p>
              <Link href={`/${artist.slug}`} className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity" style={{ color: accent }}>View all</Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {discography.map(d => (
                <Link key={d.id} href={`/release?a=${d.artistSlug}&r=${d.slug}`} className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06] mb-1.5">
                    {d.cover_url ? (
                      <Image src={d.cover_url} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw" alt={d.title} />
                    ) : (
                      <div className="w-full h-full" style={{ background: accent, opacity: 0.3 }} />
                    )}
                  </div>
                  <p className="text-xs font-bold text-zinc-300 truncate">{d.title}</p>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{d.type}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="border-t border-zinc-800 mt-4">
          <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">You may also like</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {recommendations.map(r => (
                <Link key={r.id} href={`/release?a=${r.artistSlug}&r=${r.slug}`} className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06] mb-2">
                    {r.cover_url ? (
                      <Image src={r.cover_url} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(min-width: 768px) 25vw, 50vw" alt={r.title} />
                    ) : (
                      <div className="w-full h-full bg-zinc-800" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-zinc-300 truncate">{r.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{r.artistName}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {showStickyBuy && !isOwned && (
        <div className="fixed left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-3 flex items-center justify-between gap-3 md:hidden" style={{ bottom: hasActivePlayer ? 'calc(124px + env(safe-area-inset-bottom))' : 'calc(60px + env(safe-area-inset-bottom))' }}>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{release.title}</p>
            <p className="text-xs text-orange-500 font-bold">{formatPrice(convertPrice(release.price_pence / 100, release.currency || 'GBP', currency))}</p>
          </div>
          <button
            onClick={() => openCheckout(pwywAmountPence)}
            className="shrink-0 text-black font-black text-sm px-5 py-2.5 rounded-xl"
            style={{ background: accent }}
          >
            Buy Now
          </button>
        </div>
      )}
    </main>
  )
}

/* ── Price section with PWYW support ──────────────────────────── */

function PriceSection({ release, accent, onBuy, onAmountChange }: { release: Release; accent: string; onBuy: (customAmountPence?: number) => void; onAmountChange?: (pence: number | undefined) => void }) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const relCurrency = release.currency || 'GBP'

  const defaultPounds = (release.price_pence / 100).toFixed(2)
  const minPence = release.pwyw_enabled
    ? (release.pwyw_minimum_pence ?? release.price_pence)
    : release.price_pence
  const minPounds = (minPence / 100).toFixed(2)
  const [customAmount, setCustomAmount] = useState(defaultPounds)

  const amountPence = Math.round(parseFloat(customAmount || '0') * 100)
  const isValid = amountPence >= minPence

  useEffect(() => {
    onAmountChange?.(release.pwyw_enabled && isValid ? amountPence : undefined)
  }, [amountPence, isValid, release.pwyw_enabled, onAmountChange])
  const fees = calculateFeesPence(amountPence)
  const artistGetsAmount = convertPrice(Math.max(0, fees.artistReceived) / 100, relCurrency, currency)
  const insoundFeeAmount = convertPrice(fees.insoundFee / 100, relCurrency, currency)

  const displayPrice = formatPrice(convertPrice(release.price_pence / 100, relCurrency, currency))
  const displayMin = formatPrice(convertPrice(minPence / 100, relCurrency, currency))
  const displayCustom = formatPrice(convertPrice(parseFloat(customAmount || '0'), relCurrency, currency))

  return (
    <div>
      {release.pwyw_enabled ? (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Name your price</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(customAmount || '0')
                  const next = Math.max(parseFloat(minPounds), current - 1)
                  setCustomAmount(next.toFixed(2))
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-lg transition-opacity hover:opacity-80"
                style={{ background: accent }}
                aria-label="Decrease price"
              >
                −
              </button>
              <span className="text-3xl font-black" style={{ color: accent }}>
                {(0).toLocaleString('en', { style: 'currency', currency: relCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/\d/g, '').trim()}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setCustomAmount(v)
                }}
                className="text-3xl font-black bg-transparent border-b-2 border-zinc-700 focus:border-current outline-none w-24 text-center transition-colors"
                style={{ color: accent }}
              />
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(customAmount || '0')
                  setCustomAmount((current + 1).toFixed(2))
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-lg transition-opacity hover:opacity-80"
                style={{ background: accent }}
                aria-label="Increase price"
              >
                +
              </button>
            </div>
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{relCurrency}</span>
          </div>
          <p className="text-[10px] text-zinc-600 mb-1">Minimum {displayMin}</p>
        </>
      ) : (
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-3xl font-black" style={{ color: accent }}>{displayPrice}</span>
          <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{relCurrency}</span>
        </div>
      )}

      {isValid && (
        <div className="text-[11px] text-zinc-600 mb-5 space-y-0.5">
          <p>{formatPrice(artistGetsAmount)} to the artist · {formatPrice(insoundFeeAmount)} to Insound</p>
        </div>
      )}
      {!isValid && (
        <p className="text-[11px] text-red-400 mb-5">
          Minimum amount is {displayMin}
        </p>
      )}

      <button
        onClick={() => onBuy(release.pwyw_enabled ? amountPence : undefined)}
        disabled={!isValid}
        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: accent, color: '#000' }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" /><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /></svg>
        <span>Buy for {release.pwyw_enabled ? displayCustom : displayPrice}</span>
      </button>

      <p className="text-[10px] text-zinc-600 mt-3">
        Added to your collection and available for download after payment.
      </p>
    </div>
  )
}
