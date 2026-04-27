'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { FanPinned, FanBadge } from './types'

const TopThreeShelfEditable = dynamic(
  () => import('./TopThreeShelfEditable'),
  { ssr: false }
)

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

function PinnedCardContent({ pin, accent, badges }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
}) {
  return (
    <>
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
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </>
  )
}

function PinnedCard({ pin, accent, badges }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
}) {
  return (
    <div
      className="group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl overflow-hidden transition-all hover:ring-2"
    >
      <PinnedCardContent pin={pin} accent={accent} badges={badges} />
    </div>
  )
}

export function TopThreeShelf({ pinned, badges, accent, editing, onReorder, onRemove }: {
  pinned: FanPinned[]
  badges: FanBadge[]
  accent: string
  editing: boolean
  onReorder: (reordered: FanPinned[]) => void
  onRemove: (releaseId: string) => void
}) {
  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  if (pinned.length === 0) return null

  if (editing) {
    return (
      <TopThreeShelfEditable
        pinned={pinned}
        badges={badges}
        accent={accent}
        onReorder={onReorder}
        onRemove={onRemove}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {pinned.map(pin => (
        <PinnedCard
          key={pin.release_id}
          pin={pin}
          accent={accent}
          badges={getBadgesForRelease(pin.release_id)}
        />
      ))}
    </div>
  )
}
