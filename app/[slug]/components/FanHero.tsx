'use client'

import Image from 'next/image'
import { BadgeList } from '@/app/components/ui/Badge'
import { TopThreeShelf } from './TopThreeShelf'
import type { FanProfile, FanPinned, FanBadge, FanStats } from './types'

export function FanHero({ fan, pinned, badges, stats, accent, editing, isOwner, onReorder, onRemove, onStartEditing }: {
  fan: FanProfile
  pinned: FanPinned[]
  badges: FanBadge[]
  stats: FanStats
  accent: string
  editing: boolean
  isOwner: boolean
  onReorder: (reordered: FanPinned[]) => void
  onRemove: (releaseId: string) => void
  onStartEditing: () => void
}) {
  const globalBadges = badges.filter(b => !b.release_id)

  return (
    <div className="mb-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Identity */}
        <div className="flex-1 min-w-0">
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
              {globalBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <BadgeList badges={globalBadges} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Joined {new Date(fan.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </p>
                {stats.supporterSince && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Supporter since {stats.supporterSince}
                  </p>
                )}
              </div>
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

        {/* Right: Top 3 */}
        <div className="w-full lg:w-[55%] shrink-0">
          {pinned.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl font-bold">Top 3</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pinned favourites</span>
              </div>
              <TopThreeShelf
                pinned={pinned}
                badges={badges}
                accent={accent}
                editing={editing}
                onReorder={onReorder}
                onRemove={onRemove}
              />
            </>
          ) : isOwner ? (
            <div className="bg-white/[0.02] border-2 border-dashed border-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Pin your 3 favourite releases to show them off.</p>
              <button onClick={onStartEditing} className="mt-4 text-sm font-bold" style={{ color: accent }}>
                Start pinning &rarr;
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
