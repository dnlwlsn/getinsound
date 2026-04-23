'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePlayerStore, type Track as PlayerTrack } from '@/lib/stores/player'
import { resolveAccent } from '@/lib/accent'
import { useCurrency } from '../providers/CurrencyProvider'
import { useViewMode } from '@/lib/useViewMode'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { BadgeList } from '@/app/components/ui/Badge'
import { VerifiedTick } from '@/app/components/ui/VerifiedTick'
import { SocialLinksRow } from '@/app/components/ui/SocialLinks'
import { WishlistButton } from '@/app/components/ui/WishlistButton'
import type { SocialLinks } from '@/lib/verification'
import { MerchCard } from '@/app/components/ui/MerchCard'

/* ── Types ────────────────────────────────────────────────────── */

interface Track {
  id: string
  title: string
  position: number
  duration_sec: number | null
}

interface Release {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
  currency: string | null
  published: boolean
  pwyw_enabled: boolean
  pwyw_minimum_pence: number | null
  preorder_enabled: boolean
  release_date: string | null
  tracks: Track[]
  release_tags?: { tag: string }[]
}

interface Artist {
  id: string
  slug: string
  name: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  accent_colour: string | null
}

interface ArtistBadge {
  badge_type: string
  metadata?: { position?: number } | null
}

interface MerchItem {
  id: string
  name: string
  price: number
  currency: string | null
  postage: number
  stock: number
  photos: string[]
  variants: string[] | null
}

interface Props {
  artist: Artist
  releases: Release[]
  badges?: ArtistBadge[]
  verified?: boolean
  socialLinks?: SocialLinks | null
  merch?: MerchItem[]
}

/* ── Gradient fallback ────────────────────────────────────────── */

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

function generateGradient(id1: string, id2: string) {
  const hash = cyrb53(`${id1}:${id2}`)
  const r = seededRand(hash)
  const h1 = Math.floor(r() * 360), off = 40 + Math.floor(r() * 80), h2 = (h1 + off) % 360
  const c1 = hslHex(h1, 60 + Math.floor(r() * 30), 35 + Math.floor(r() * 20))
  const c2 = hslHex(h2, 60 + Math.floor(r() * 30), 35 + Math.floor(r() * 20))
  return `linear-gradient(135deg, ${c1}, ${c2})`
}

function bannerGradient(artistId: string, accent: string) {
  return `linear-gradient(135deg, ${accent}22 0%, #09090b 40%, #09090b 60%, ${accent}11 100%)`
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function makePriceDisplay(
  release: Release,
  formatPrice: (amount: number, currency?: string) => string,
  convertPrice: (amount: number, from: string, to: string) => number,
  currency: string,
) {
  const artistCurrency = release.currency || 'GBP'
  if (release.pwyw_enabled) {
    const min = release.pwyw_minimum_pence != null ? release.pwyw_minimum_pence : release.price_pence
    return { label: `from ${formatPrice(convertPrice(min / 100, artistCurrency, currency))}`, sub: 'or more' }
  }
  return { label: formatPrice(convertPrice(release.price_pence / 100, artistCurrency, currency)), sub: null }
}

function typeLabel(type: string) {
  return { single: 'Single', ep: 'EP', album: 'Album' }[type] || 'Release'
}

function isPreorder(release: Release) {
  if (!release.preorder_enabled || !release.release_date) return false
  return new Date(release.release_date) > new Date()
}

/* ── Component ────────────────────────────────────────────────── */

export default function ArtistProfileClient({ artist, releases, badges = [], verified = false, socialLinks, merch = [] }: Props) {
  const accent = resolveAccent(artist.accent_colour)
  const { currency, formatPrice, convertPrice } = useCurrency()
  const play = usePlayerStore(s => s.play)
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const pause = usePlayerStore(s => s.pause)
  const resume = usePlayerStore(s => s.resume)
  const { mode: viewMode, set: setViewMode } = useViewMode()

  const handlePlayTrack = useCallback((release: Release, track: Track, trackIndex: number) => {
    const queue: PlayerTrack[] = release.tracks.map(t => ({
      id: t.id,
      title: t.title,
      artistName: artist.name,
      artistSlug: artist.slug,
      releaseId: release.id,
      releaseTitle: release.title,
      coverUrl: release.cover_url,
      position: t.position,
      durationSec: t.duration_sec,
      accentColour: artist.accent_colour,
      purchased: false,
    }))
    play(queue[trackIndex], queue)
  }, [artist, play])

  const handleToggleTrack = useCallback((trackId: string, release: Release, track: Track, trackIndex: number) => {
    if (currentTrack?.id === trackId) {
      isPlaying ? pause() : resume()
    } else {
      handlePlayTrack(release, track, trackIndex)
    }
  }, [currentTrack, isPlaying, pause, resume, handlePlayTrack])

  const albumsAndEps = releases.filter(r => r.type === 'album' || r.type === 'ep')
  const singles = releases.filter(r => r.type === 'single')

  const handleShare = useCallback(async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: artist.name, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      const toast = document.getElementById('artist-toast')
      if (toast) {
        toast.textContent = 'Link copied!'
        toast.style.opacity = '1'
        toast.style.transform = 'translateX(-50%) translateY(0)'
        setTimeout(() => {
          toast.style.opacity = '0'
          toast.style.transform = 'translateX(-50%) translateY(1rem)'
        }, 2000)
      }
    }
  }, [artist.name])

  return (
    <main className="flex-1 relative min-h-screen" style={{ '--artist-accent': accent } as React.CSSProperties}>
      {/* Banner */}
      <div className="relative h-48 md:h-64 overflow-hidden" style={artist.banner_url ? {} : { background: bannerGradient(artist.id, accent) }}>
        {artist.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.banner_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#09090b_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#09090b] to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10 -mt-20">
        {/* Artist header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-10">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-zinc-950 bg-zinc-900 shrink-0 shadow-2xl">
            {artist.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-600" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}11)` }}>
                {artist.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: accent }}>Artist</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight font-display text-white">
                {artist.name}
              </h1>
              {verified && <VerifiedTick size={20} />}
              {badges.length > 0 && <BadgeList badges={badges} />}
            </div>
            {artist.bio && (
              <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-lg">{artist.bio}</p>
            )}
            {socialLinks && <SocialLinksRow links={socialLinks} />}
            {releases.length > 0 && (
              <p className="text-zinc-600 text-xs mt-2 font-bold">
                {releases.length} release{releases.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <button
            onClick={handleShare}
            className="shrink-0 w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            aria-label="Share"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>
        </div>

        {/* Releases */}
        {releases.length > 0 ? (
          <section className="pb-32">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Discography</p>
              <ViewToggle mode={viewMode} onToggle={setViewMode} />
            </div>

            {viewMode === 'compact' && (
              <>
                {albumsAndEps.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {albumsAndEps.map((release) => {
                      const price = makePriceDisplay(release, formatPrice, convertPrice, currency)
                      const preorder = isPreorder(release)

                      return (
                        <div key={release.id} className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                          <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                            {release.cover_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={release.cover_url} alt={release.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ background: generateGradient(artist.id, release.id) }} />
                            )}
                          </Link>
                          <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0 hover:opacity-80 transition-opacity">
                            {release.title}
                          </Link>
                          <span className="hidden md:block text-[10px] font-black uppercase tracking-widest text-zinc-500 flex-shrink-0">{typeLabel(release.type)}</span>
                          {release.release_tags && release.release_tags.length > 0 && (
                            <span className="hidden lg:flex gap-1 flex-shrink-0">
                              {release.release_tags.map(({ tag }) => (
                                <span key={tag} className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-800/60 px-1.5 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </span>
                          )}
                          {preorder && (
                            <span className="hidden lg:inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0" style={{ color: accent, borderColor: `${accent}44` }}>
                              Pre-order
                            </span>
                          )}
                          <span className="flex-1" />
                          <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: accent }}>{price.label}</span>
                          <WishlistButton releaseId={release.id} size={16} />
                          <button
                            onClick={() => {
                              if (release.tracks.length > 0) handlePlayTrack(release, release.tracks[0], 0)
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                            style={{ background: accent }}
                            aria-label="Play"
                          >
                            <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                          <Link
                            href={`/release?a=${artist.slug}&r=${release.slug}`}
                            className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04] transition-all shrink-0"
                          >
                            {preorder ? 'Pre-order' : 'Buy'}
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
                {singles.length > 0 && (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-8 mb-3">Singles</p>
                    <div className="flex flex-col gap-1">
                      {singles.map((release) => {
                        const price = makePriceDisplay(release, formatPrice, convertPrice, currency)
                        const preorder = isPreorder(release)

                        return (
                          <div key={release.id} className="group flex items-center gap-3 md:gap-4 h-14 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                            <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                              {release.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={release.cover_url} alt={release.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ background: generateGradient(artist.id, release.id) }} />
                              )}
                            </Link>
                            <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="font-semibold text-sm text-white truncate min-w-0 flex-shrink md:w-48 md:flex-shrink-0 hover:opacity-80 transition-opacity">
                              {release.title}
                            </Link>
                            {preorder && (
                              <span className="hidden lg:inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0" style={{ color: accent, borderColor: `${accent}44` }}>
                                Pre-order
                              </span>
                            )}
                            <span className="flex-1" />
                            <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: accent }}>{price.label}</span>
                            <WishlistButton releaseId={release.id} size={16} />
                            <button
                              onClick={() => {
                                if (release.tracks.length > 0) handlePlayTrack(release, release.tracks[0], 0)
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                              style={{ background: accent }}
                              aria-label="Play"
                            >
                              <svg width="14" height="14" fill="#000" viewBox="0 0 24 24" className="ml-0.5">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                            <Link
                              href={`/release?a=${artist.slug}&r=${release.slug}`}
                              className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04] transition-all shrink-0"
                            >
                              {preorder ? 'Pre-order' : 'Buy'}
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {viewMode === 'expanded' && <>
              {albumsAndEps.length > 0 && <div className="space-y-10">
                {albumsAndEps.map((release) => {
                  const price = makePriceDisplay(release, formatPrice, convertPrice, currency)
                  const preorder = isPreorder(release)
                  const trackCount = release.tracks.length

                  return (
                    <div key={release.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 md:p-6 hover:border-zinc-700/80 transition-colors">
                      <div className="flex flex-col sm:flex-row gap-5 md:gap-6">
                        <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="shrink-0 group">
                          <div className="w-full sm:w-40 md:w-48 aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 transition-transform group-hover:scale-[1.02]">
                            {release.cover_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={release.cover_url} alt={release.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ background: generateGradient(artist.id, release.id) }} />
                            )}
                          </div>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{typeLabel(release.type)}</span>
                                {preorder && (
                                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border" style={{ color: accent, borderColor: `${accent}44` }}>
                                    Pre-order
                                  </span>
                                )}
                              </div>
                              <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="hover:opacity-80 transition-opacity">
                                <h2 className="text-xl md:text-2xl font-black tracking-tight font-display">{release.title}</h2>
                              </Link>
                              {release.release_tags && release.release_tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {release.release_tags.map(({ tag }) => (
                                    <span key={tag} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800/60 rounded-full">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {preorder && release.release_date && (
                                <p className="text-zinc-500 text-xs mt-1 font-medium">
                                  Releases {new Date(release.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <span className="inline-block px-3.5 py-1.5 rounded-full text-sm font-black" style={{ background: `${accent}22`, color: accent }}>
                                {price.label}
                              </span>
                              {price.sub && (
                                <p className="text-[10px] text-zinc-500 mt-1 font-bold">{price.sub}</p>
                              )}
                            </div>
                          </div>

                          {trackCount > 0 && (
                            <div className="mt-4 border-t border-zinc-800/60 pt-3">
                              <ol className="space-y-0.5">
                                {release.tracks.map((track, i) => {
                                  const isActive = currentTrack?.id === track.id
                                  const isTrackPlaying = isActive && isPlaying

                                  return (
                                    <li key={track.id} className="group/track">
                                      <button
                                        onClick={() => handleToggleTrack(track.id, release, track, i)}
                                        className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors text-left ${isActive ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40'}`}
                                      >
                                        <span className="w-6 text-center shrink-0">
                                          {isTrackPlaying ? (
                                            <span className="inline-flex gap-[2px] items-end h-3">
                                              <span className="w-[3px] h-full rounded-full animate-pulse" style={{ background: accent }} />
                                              <span className="w-[3px] h-2/3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '150ms' }} />
                                              <span className="w-[3px] h-1/3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '300ms' }} />
                                            </span>
                                          ) : isActive ? (
                                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ color: accent }}>
                                              <rect x="6" y="4" width="4" height="16" rx="1" />
                                              <rect x="14" y="4" width="4" height="16" rx="1" />
                                            </svg>
                                          ) : (
                                            <>
                                              <span className="text-zinc-600 font-mono text-xs group-hover/track:hidden">{String(i + 1).padStart(2, '0')}</span>
                                              <svg className="hidden group-hover/track:block mx-auto" width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ color: accent }}>
                                                <path d="M8 5v14l11-7z" />
                                              </svg>
                                            </>
                                          )}
                                        </span>
                                        <span className={`font-bold text-sm flex-1 truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>{track.title}</span>
                                        {track.duration_sec && (
                                          <span className="text-zinc-600 text-xs font-mono shrink-0">{formatDuration(track.duration_sec)}</span>
                                        )}
                                      </button>
                                    </li>
                                  )
                                })}
                              </ol>
                            </div>
                          )}

                          <div className="mt-4 flex items-center gap-3">
                            <Link
                              href={`/release?a=${artist.slug}&r=${release.slug}`}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                              style={{ background: accent, color: '#000' }}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" />
                                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                              </svg>
                              {preorder ? 'Pre-order' : 'Buy'} {price.label}
                            </Link>
                            <WishlistButton releaseId={release.id} size={20} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>}

              {singles.length > 0 && <>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-12 mb-4">Singles</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {singles.map((release) => {
                    const price = makePriceDisplay(release, formatPrice, convertPrice, currency)
                    const preorder = isPreorder(release)

                    return (
                      <div key={release.id} className="group">
                        <Link href={`/release?a=${artist.slug}&r=${release.slug}`}>
                          <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-2.5 transition-transform group-hover:scale-[1.02] relative">
                            {release.cover_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={release.cover_url} alt={release.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ background: generateGradient(artist.id, release.id) }} />
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center justify-between">
                          <Link href={`/release?a=${artist.slug}&r=${release.slug}`} className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-white truncate group-hover:opacity-80 transition-opacity">{release.title}</p>
                          </Link>
                          <WishlistButton releaseId={release.id} size={16} />
                        </div>
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: accent }}>
                          {price.label}
                          {preorder && <span className="text-zinc-600 ml-1.5">Pre-order</span>}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </>}
            </>}
          </section>
        ) : (
          <div className="text-center py-24 pb-32">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-600">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="text-zinc-500 text-sm font-bold mb-1">No releases yet</p>
            <p className="text-zinc-600 text-xs">Check back soon.</p>
          </div>
        )}
      </div>

      {merch.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 md:px-12 pb-32">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-8">Merch</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {merch.map((item) => {
              const artistCurrency = item.currency || 'GBP'
              const displayPrice = formatPrice(convertPrice(item.price / 100, artistCurrency, currency))
              const photo = item.photos?.length > 0 ? item.photos[0] : null

              return (
                <MerchCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  price={displayPrice}
                  photo={photo}
                  artistSlug={artist.slug}
                  soldOut={item.stock <= 0}
                  accent={accent}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        id="artist-toast"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[300] transition-all duration-300 opacity-0 translate-y-4 pointer-events-none"
      />
    </main>
  )
}
