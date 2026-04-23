'use client'

import Link from 'next/link'
import { VinylCard } from './VinylCard'
import type { FanPurchase, FanPinned, FanBadge } from './types'

export function VinylCollection({ purchases, pinned, badges, accent, showAmount, editing, isOwner, onTogglePin }: {
  purchases: FanPurchase[]
  pinned: FanPinned[]
  badges: FanBadge[]
  accent: string
  showAmount: boolean
  editing: boolean
  isOwner: boolean
  onTogglePin: (releaseId: string) => void
}) {
  if (purchases.length === 0) {
    return (
      <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-12 text-center">
        {isOwner ? (
          <>
            <p className="text-zinc-400 text-sm">Your collection is empty. Once you start buying music, it&rsquo;ll appear here.</p>
            <Link href="/discover" className="mt-4 inline-block text-sm font-bold" style={{ color: accent }}>
              Discover music &rarr;
            </Link>
          </>
        ) : (
          <p className="text-zinc-500 text-sm">No music yet.</p>
        )}
      </div>
    )
  }

  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  return (
    <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold">Collection</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {purchases.length} release{purchases.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {purchases.map(purchase => (
          <VinylCard
            key={purchase.id}
            purchase={purchase}
            accent={accent}
            showAmount={showAmount}
            editing={editing}
            isPinned={pinned.some(p => p.release_id === purchase.releases.id)}
            onTogglePin={onTogglePin}
            badges={getBadgesForRelease(purchase.releases.id)}
          />
        ))}
      </div>
    </div>
  )
}
