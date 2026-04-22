'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import { createClient } from '@/lib/supabase/client'

/* ── Types ────────────────────────────────────────────────────── */

interface FanRelease {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
}

interface FanArtist {
  slug: string
  name: string
  accent_colour: string | null
}

interface FanPurchase {
  id: string
  amount_pence: number
  paid_at: string
  releases: FanRelease
  artists: FanArtist
}

interface FanPinned {
  position: number
  release_id: string
  releases: FanRelease & { artists: FanArtist }
}

interface FanBadge {
  badge_type: string
  release_id: string | null
  awarded_at: string
}

interface WallPost {
  id: string
  artist_id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
  artists: { slug: string; name: string; accent_colour: string | null; avatar_url: string | null }
}

interface FanStats {
  supporterSince: number | null
  totalArtists: number
  totalReleases: number
  mostSupportedArtist: { name: string; count: number } | null
}

interface FanProfile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  created_at: string
}

interface Props {
  fan: FanProfile
  purchases: FanPurchase[]
  pinned: FanPinned[]
  badges: FanBadge[]
  wallPosts: WallPost[]
  stats: FanStats
  favouriteGenre: string | null
  isOwner: boolean
}

/* ── Badge helpers ────────────────────────────────────────────── */

const BADGE_META: Record<string, { label: string; icon: string }> = {
  founding_fan: { label: 'Founding Fan', icon: '⭐' },
  limited_edition: { label: 'Limited Edition', icon: '💎' },
  early_supporter: { label: 'Early Supporter', icon: '🎵' },
}

function badgeLabel(type: string): string {
  return BADGE_META[type]?.label ?? type
}

function badgeIcon(type: string): string {
  return BADGE_META[type]?.icon ?? '🏷'
}

/* ── Time helpers ─────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ── Component ────────────────────────────────────────────────── */

export function FanProfileClient({ fan, purchases, pinned, badges, wallPosts, stats, favouriteGenre, isOwner }: Props) {
  const accent = resolveAccent(fan.accent_colour)
  const supabase = createClient()

  // Edit mode state for pinning
  const [editing, setEditing] = useState(false)
  const [localPinned, setLocalPinned] = useState<FanPinned[]>(pinned)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // ── Pin / Unpin ────────────────────────────────────────────
  const togglePin = useCallback(async (releaseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existingIdx = localPinned.findIndex(p => p.release_id === releaseId)

    if (existingIdx >= 0) {
      await supabase.from('fan_pinned_releases')
        .delete().eq('user_id', user.id).eq('release_id', releaseId)
      setLocalPinned(prev => prev.filter(p => p.release_id !== releaseId))
    } else {
      if (localPinned.length >= 3) return
      const usedPositions = new Set(localPinned.map(p => p.position))
      const nextPos = [1, 2, 3].find(p => !usedPositions.has(p))!

      await supabase.from('fan_pinned_releases')
        .insert({ user_id: user.id, release_id: releaseId, position: nextPos })

      const purchase = purchases.find(p => p.releases.id === releaseId)
      if (purchase) {
        setLocalPinned(prev => [...prev, {
          position: nextPos,
          release_id: releaseId,
          releases: { ...purchase.releases, artists: purchase.artists },
        }].sort((a, b) => a.position - b.position))
      }
    }
  }, [localPinned, purchases, supabase])

  // ── Drag to reorder Top 3 ──────────────────────────────────
  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newPinned = [...localPinned]
    const [moved] = newPinned.splice(dragIndex, 1)
    newPinned.splice(dropIndex, 0, moved)
    const updated = newPinned.map((pin, i) => ({ ...pin, position: i + 1 }))
    setLocalPinned(updated)

    for (const pin of updated) {
      await supabase.from('fan_pinned_releases')
        .update({ position: pin.position })
        .eq('user_id', user.id)
        .eq('release_id', pin.release_id)
    }
    setDragIndex(null)
  }

  // ── Badge lookup for a release ─────────────────────────────
  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  const globalBadges = badges.filter(b => !b.release_id)

  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between"
          style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <Link href="/" className="font-display text-lg font-bold">
            insound<span style={{ color: accent }}>.</span>
          </Link>
          <div className="flex items-center gap-3">
            {isOwner && (
              <>
                <Link href="/settings/profile"
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                  Settings
                </Link>
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
                  style={editing
                    ? { background: accent, color: '#000' }
                    : { color: accent, border: `1px solid ${accent}33` }
                  }
                >
                  {editing ? 'Done' : 'Edit'}
                </button>
              </>
            )}
            {!isOwner && (
              <Link href="/explore"
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                Explore
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* ── Bento Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Profile Header (2 cols) ──────────────────────── */}
          <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
            <div className="flex items-start gap-6">
              {fan.avatar_url ? (
                <Image src={fan.avatar_url} alt={fan.username} width={80} height={80}
                  className="rounded-full object-cover w-20 h-20 shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                  style={{ background: `${accent}22`, color: accent }}>
                  {fan.username[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold truncate">{fan.username}</h1>
                {fan.bio && (
                  <p className="text-zinc-400 text-sm mt-1 leading-relaxed line-clamp-3">{fan.bio}</p>
                )}
                {/* Badges */}
                {globalBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {globalBadges.map(b => (
                      <span key={`${b.badge_type}-${b.release_id}`}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                        style={{ background: `${accent}15`, color: accent }}>
                        {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                      </span>
                    ))}
                  </div>
                )}
                {stats.supporterSince && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-3">
                    Supporter since {stats.supporterSince}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-8 mt-6 pt-6 border-t border-white/[0.04]">
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: accent }}>{stats.totalReleases}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Releases</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: accent }}>{stats.totalArtists}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Artists</p>
              </div>
            </div>
          </div>

          {/* ── Stats Sidebar (1 col) ────────────────────────── */}
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Supporter Stats</h2>
            <div className="space-y-5">
              {stats.supporterSince && (
                <div>
                  <p className="text-xs text-zinc-500">Supporter since</p>
                  <p className="font-display font-bold text-lg">{stats.supporterSince}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500">Artists supported</p>
                <p className="font-display font-bold text-lg">{stats.totalArtists}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Releases owned</p>
                <p className="font-display font-bold text-lg">{stats.totalReleases}</p>
              </div>
              {stats.mostSupportedArtist && (
                <div>
                  <p className="text-xs text-zinc-500">Most supported</p>
                  <p className="font-display font-bold text-lg">{stats.mostSupportedArtist.name}</p>
                  <p className="text-[10px] text-zinc-600">
                    {stats.mostSupportedArtist.count} release{stats.mostSupportedArtist.count !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {favouriteGenre && (
                <div>
                  <p className="text-xs text-zinc-500">Favourite genre</p>
                  <p className="font-display font-bold text-lg capitalize">{favouriteGenre}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Top 3 Shelf (3 cols) ─────────────────────────── */}
          {localPinned.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">Top 3</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pinned favourites</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {localPinned.map((pin, i) => {
                  const releaseBadges = getBadgesForRelease(pin.release_id)
                  return (
                    <div
                      key={pin.release_id}
                      className="group relative bg-white/[0.02] ring-1 rounded-3xl overflow-hidden transition-all hover:ring-2"
                      style={{ ringColor: `${accent}33` }}
                      draggable={editing}
                      onDragStart={editing ? (e) => handleDragStart(e, i) : undefined}
                      onDragOver={editing ? handleDragOver : undefined}
                      onDrop={editing ? (e) => handleDrop(e, i) : undefined}
                    >
                      <Link href={`/${pin.releases.artists.slug}`}>
                        {pin.releases.cover_url ? (
                          <div className="aspect-square relative">
                            <Image src={pin.releases.cover_url} alt={pin.releases.title} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-square flex items-center justify-center" style={{ background: `${accent}11` }}>
                            <svg width="48" height="48" fill="none" stroke={accent} strokeWidth="1.5" viewBox="0 0 24 24">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="p-5">
                          <p className="font-display font-bold truncate group-hover:text-white transition-colors">{pin.releases.title}</p>
                          <p className="text-xs text-zinc-500 mt-1">{pin.releases.artists.name}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                              style={{ background: `${accent}15`, color: accent }}>
                              {pin.releases.type}
                            </span>
                            {releaseBadges.map(b => (
                              <span key={b.badge_type}
                                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>

                      {/* Edit mode: drag handle + remove */}
                      {editing && (
                        <>
                          <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white/70">
                              <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" />
                              <circle cx="4" cy="7" r="1.5" /><circle cx="10" cy="7" r="1.5" />
                              <circle cx="4" cy="11" r="1.5" /><circle cx="10" cy="11" r="1.5" />
                            </svg>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); togglePin(pin.release_id) }}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-white text-sm backdrop-blur-sm hover:bg-red-500 transition-colors"
                          >
                            &times;
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty Top 3 prompt (owner only) */}
          {localPinned.length === 0 && isOwner && (
            <div className="lg:col-span-3 bg-white/[0.02] border-2 border-dashed border-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Pin your 3 favourite releases to show them off.</p>
              <button onClick={() => setEditing(true)} className="mt-4 text-sm font-bold" style={{ color: accent }}>
                Start pinning &rarr;
              </button>
            </div>
          )}

          {/* ── Digital Vinyl Shelf (3 cols) ──────────────────── */}
          {purchases.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">Collection</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {purchases.length} release{purchases.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {purchases.map((purchase) => (
                  <VinylCard
                    key={purchase.id}
                    purchase={purchase}
                    accent={accent}
                    showAmount={fan.show_purchase_amounts}
                    editing={editing}
                    isPinned={localPinned.some(p => p.release_id === purchase.releases.id)}
                    onTogglePin={togglePin}
                    badges={getBadgesForRelease(purchase.releases.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {purchases.length === 0 && (
            <div className="lg:col-span-3 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">No music yet.</p>
              <Link href="/explore" className="mt-4 inline-block text-sm font-bold" style={{ color: accent }}>
                Discover something new &rarr;
              </Link>
            </div>
          )}

          {/* ── The Wall (3 cols) ─────────────────────────────── */}
          {wallPosts.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">The Wall</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Artist updates</span>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {wallPosts.map(post => {
                  const postAccent = resolveAccent(post.artists.accent_colour)
                  return (
                    <div key={post.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <Link href={`/${post.artists.slug}`} className="shrink-0">
                          {post.artists.avatar_url ? (
                            <Image src={post.artists.avatar_url} alt={post.artists.name} width={36} height={36}
                              className="rounded-full object-cover w-9 h-9" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{ background: `${postAccent}22`, color: postAccent }}>
                              {post.artists.name[0]}
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/${post.artists.slug}`} className="font-bold text-sm hover:text-white transition-colors truncate block">
                            {post.artists.name}
                          </Link>
                          <p className="text-[10px] text-zinc-600">{timeAgo(post.created_at)}</p>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.04] text-zinc-500">
                          {post.post_type === 'voice_note' ? 'Voice Note' : post.post_type}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      {post.media_url && (
                        <div className="mt-3 rounded-xl overflow-hidden">
                          {post.post_type === 'photo' ? (
                            <Image src={post.media_url} alt="Post media" width={600} height={400}
                              className="w-full h-auto object-cover max-h-80" />
                          ) : (
                            <div className="bg-white/[0.03] rounded-xl p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: `${postAccent}22` }}>
                                <svg width="16" height="16" fill={postAccent} viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-zinc-400 truncate">
                                  {post.post_type === 'demo' ? 'Demo' : 'Voice Note'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}

/* ── Vinyl Card ──────────────────────────────────────────────── */

function VinylCard({ purchase, accent, showAmount, editing, isPinned, onTogglePin, badges }: {
  purchase: FanPurchase
  accent: string
  showAmount: boolean
  editing: boolean
  isPinned: boolean
  onTogglePin: (releaseId: string) => void
  badges: FanBadge[]
}) {
  const isAlbum = purchase.releases.type === 'album'

  function handleTilt(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`
  }

  function resetTilt(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.transform = ''
  }

  return (
    <div
      className={`group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden transition-transform duration-300 ease-out ${isAlbum ? 'sm:col-span-2 sm:row-span-2' : ''}`}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
    >
      <Link href={`/${purchase.artists.slug}`}>
        {purchase.releases.cover_url ? (
          <div className="aspect-square relative">
            <Image src={purchase.releases.cover_url} alt={purchase.releases.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="aspect-square flex items-center justify-center bg-zinc-900">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-700">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="p-4">
          <p className="font-display font-bold text-sm truncate group-hover:text-white transition-colors">{purchase.releases.title}</p>
          <p className="text-xs text-zinc-500 mt-1 truncate">{purchase.artists.name}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${accent}15`, color: accent }}>
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
          {showAmount && (
            <p className="text-[10px] text-zinc-600 mt-2">&pound;{(purchase.amount_pence / 100).toFixed(2)}</p>
          )}
        </div>
      </Link>

      {/* Pinned indicator */}
      {isPinned && !editing && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{ background: accent, color: '#000' }}>
          &#9733;
        </div>
      )}

      {/* Edit mode: pin/unpin button */}
      {editing && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(purchase.releases.id) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm backdrop-blur-sm"
          style={isPinned
            ? { background: accent, color: '#000' }
            : { background: 'rgba(0,0,0,0.6)', color: '#fff' }
          }
        >
          {isPinned ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
