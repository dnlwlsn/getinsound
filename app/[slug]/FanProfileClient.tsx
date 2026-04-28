'use client'

import { useState, useCallback } from 'react'
import { ReportModal } from '@/app/components/ui/ReportModal'
import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import { createClient } from '@/lib/supabase/client'
import { FanHero } from './components/FanHero'
import { VinylCollection } from './components/VinylCollection'
import { SupporterStats } from './components/SupporterStats'
import { BadgeShowcase } from './components/BadgeShowcase'
import { TheWall } from './components/TheWall'
import type { FanProfile, FanPurchase, FanPinned, FanBadge, WallPost, FanStats } from './components/types'

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

export function FanProfileClient({ fan, purchases, pinned, badges, wallPosts, stats, favouriteGenre, isOwner }: Props) {
  const accent = resolveAccent(fan.accent_colour)
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [localPinned, setLocalPinned] = useState<FanPinned[]>(pinned)
  const [showReport, setShowReport] = useState(false)

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

  const handleReorder = useCallback(async (reordered: FanPinned[]) => {
    setLocalPinned(reordered)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const pin of reordered) {
      await supabase.from('fan_pinned_releases')
        .update({ position: pin.position })
        .eq('user_id', user.id)
        .eq('release_id', pin.release_id)
    }
  }, [supabase])

  return (
    <main className="bg-zinc-950 text-white min-h-screen">
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {isOwner && !fan.is_public && (
          <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-400">
              This is how your profile looks. It&rsquo;s currently <span className="text-white font-bold">private</span> — only you can see this.
            </p>
            <Link href="/settings/profile"
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
              style={{ color: accent, border: `1px solid ${accent}33` }}>
              Settings
            </Link>
          </div>
        )}

        <FanHero
          fan={fan}
          pinned={localPinned}
          badges={badges}
          stats={stats}
          accent={accent}
          editing={editing}
          isOwner={isOwner}
          onReorder={handleReorder}
          onRemove={togglePin}
          onStartEditing={() => setEditing(true)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {fan.show_collection && (
            <VinylCollection
              purchases={purchases}
              pinned={localPinned}
              badges={badges}
              accent={accent}
              showAmount={fan.show_purchase_amounts}
              editing={editing}
              isOwner={isOwner}
              onTogglePin={togglePin}
            />
          )}

          <SupporterStats stats={stats} favouriteGenre={favouriteGenre} accent={accent} />

          {fan.show_wall && <TheWall posts={wallPosts} />}

          <BadgeShowcase badges={badges} accent={accent} />
        </div>
      </div>

      {!isOwner && (
        <div className="max-w-6xl mx-auto px-6 pb-8 flex justify-end">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 text-zinc-600 hover:text-red-400 text-xs font-bold transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Report profile
          </button>
        </div>
      )}

      {showReport && (
        <ReportModal
          profileType="fan"
          fanId={fan.id}
          profileName={fan.username}
          onClose={() => setShowReport(false)}
        />
      )}

      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
