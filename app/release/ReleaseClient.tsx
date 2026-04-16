'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
interface Release { id: string; slug: string; title: string; type: string; cover_url: string | null; price_pence: number; currency: string; published: boolean; tracks: Track[] }
interface Artist { id: string; slug: string; name: string; bio: string; avatar_url: string; accent_colour: string | null }

type Stage = 'checkout' | 'preparing' | 'download' | 'error'

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TM4GsGkY3otnyNsltYWVo9N1xWEzKEUa8B4XjPlmSnP5VLCKAnkTebfHM8QOkmLTxyxxhNKQ4iJ9karlBfo5jEv007Ts2uEgI'

export default function ReleaseClient() {
  const searchParams = useSearchParams()
  const artistSlug = searchParams.get('a')
  const releaseSlug = searchParams.get('r')

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [artist, setArtist] = useState<Artist | null>(null)
  const [release, setRelease] = useState<Release | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('checkout')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadTracks, setDownloadTracks] = useState<{ title: string; url?: string }[]>([])
  const [downloadTitle, setDownloadTitle] = useState('')

  const stripeMountRef = useRef<HTMLDivElement>(null)
  const embeddedCheckoutRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      if (!artistSlug || !releaseSlug) { setNotFound(true); setLoading(false); return }

      const supabase = createClient()
      const { data: a, error: aErr } = await supabase
        .from('artists')
        .select('id, slug, name, bio, avatar_url, accent_colour')
        .eq('slug', artistSlug)
        .maybeSingle()
      if (aErr || !a) { setNotFound(true); setLoading(false); return }

      const { data: rel, error: rErr } = await supabase
        .from('releases')
        .select('id, slug, title, type, cover_url, price_pence, currency, published, tracks(id, title, position, duration_sec)')
        .eq('artist_id', a.id)
        .eq('slug', releaseSlug)
        .eq('published', true)
        .maybeSingle()
      if (rErr || !rel) { setNotFound(true); setLoading(false); return }

      const accent = a.accent_colour || '#F56D00'
      document.documentElement.style.setProperty('--artist-accent', accent)
      document.title = `${rel.title} — ${a.name} | Insound`

      setArtist(a)
      setRelease(rel)
      setLoading(false)
    }
    load()
  }, [artistSlug, releaseSlug])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    document.body.style.overflow = ''
    if (embeddedCheckoutRef.current) {
      try { embeddedCheckoutRef.current.destroy() } catch {}
      embeddedCheckoutRef.current = null
    }
    if (stripeMountRef.current) stripeMountRef.current.innerHTML = ''
  }, [])

  const openCheckout = useCallback(async () => {
    if (!release || !artist) return
    setStage('checkout')
    setModalOpen(true)
    document.body.style.overflow = 'hidden'

    try {
      const stripe = (window as any).Stripe(STRIPE_PUBLISHABLE_KEY)
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('checkout-create', {
        body: { release_id: release.id, origin: window.location.origin },
      })
      if (error) throw error
      if (!data?.client_secret) throw new Error('No checkout session returned')

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
      console.error(err)
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center text-zinc-600 font-bold text-sm">
        Loading...
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4">404</p>
        <h1 className="text-3xl font-black mb-3 font-display">Release not found.</h1>
        <p className="text-zinc-500 font-medium mb-8">This release doesn&apos;t exist, or it&apos;s been unpublished by the artist.</p>
        <Link href="/" className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">
          Back to Home
        </Link>
      </div>
    )
  }

  if (!artist || !release) return null

  const tracks = [...release.tracks].sort((a, b) => a.position - b.position)
  const price = (release.price_pence / 100).toFixed(2)
  const artistCut = ((release.price_pence * 0.9) / 100).toFixed(2)
  const typeLabel = { single: 'Single', ep: 'EP', album: 'Album' }[release.type] || 'Release'
  const coverSrc = release.cover_url || generateGradientDataUri(artist.id, release.id)

  return (
    <>
      {/* Stripe.js script */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <script src="https://js.stripe.com/v3/" async />

      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)] pointer-events-none" />

        <article className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-16 animate-slide-in-up">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-start">
            {/* Cover */}
            <div className="relative">
              <div className="aspect-square w-full rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverSrc} alt={`${release.title} cover art`} className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Details */}
            <div>
              <Link href={`/artist?a=${artist.slug}`} className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-400 transition-colors">
                {artist.name}
              </Link>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-3 mb-2 font-display">{release.title}</h1>
              <p className="text-zinc-500 text-sm mb-8">{typeLabel} · {tracks.length} track{tracks.length === 1 ? '' : 's'}</p>

              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-4xl font-black text-orange-600">&pound;{price}</span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">GBP</span>
              </div>
              <p className="text-[11px] text-zinc-600 mb-6">
                &pound;{artistCut} goes directly to the artist.
              </p>

              <button
                onClick={openCheckout}
                className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" /><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /></svg>
                <span>Buy for &pound;{price}</span>
              </button>

              <p className="text-center text-[10px] text-zinc-600 mt-4">
                Instant download after payment. 90% goes to the artist.
              </p>

              {/* Tracklist */}
              <div className="mt-10 border-t border-zinc-800 pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Tracklist</p>
                <ol className="space-y-2">
                  {tracks.map((t, i) => (
                    <li key={t.id} className="flex items-center gap-4 py-2">
                      <span className="text-zinc-600 font-mono text-xs w-6">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-bold text-sm flex-1">{t.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </article>
      </main>

      {/* Toast */}
      <div id="toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[300] transition-all duration-300 opacity-0 translate-y-4" />

      {/* Checkout / Download Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="min-h-screen flex items-start md:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl relative my-8 overflow-hidden">
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
                  <div ref={stripeMountRef} className="rounded-3xl overflow-hidden" />
                </div>
              )}

              {/* Stage: Preparing */}
              {stage === 'preparing' && (
                <div className="p-12 text-center">
                  <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Finalising</p>
                  <h2 className="text-xl font-black mb-2 font-display">Preparing your download...</h2>
                  <p className="text-zinc-500 text-sm font-medium">This usually takes a few seconds.</p>
                </div>
              )}

              {/* Stage: Download ready */}
              {stage === 'download' && (
                <div className="p-6 md:p-8">
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
                  <p className="text-center text-[11px] text-zinc-600 font-medium">A receipt has been sent by Stripe. Bookmark this tab if you need to come back.</p>
                </div>
              )}

              {/* Stage: Error */}
              {stage === 'error' && (
                <div className="p-12 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Something&apos;s off</p>
                  <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
                  <p className="text-zinc-500 text-sm font-medium mb-6">{errorMsg}</p>
                  <button onClick={closeModal} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Close</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
