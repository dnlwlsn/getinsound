import { BadgeList } from '@/app/components/ui/Badge'
import type { FanBadge } from './types'

export function BadgeShowcase({ badges, accent }: {
  badges: FanBadge[]
  accent: string
}) {
  if (badges.length === 0) return null

  const globalBadges = badges.filter(b => !b.release_id)
  const releaseBadges = badges.filter(b => b.release_id)

  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Badges</h2>
      <div className="space-y-4">
        {globalBadges.length > 0 && (
          <div>
            <BadgeList badges={globalBadges} />
          </div>
        )}
        {releaseBadges.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
              {releaseBadges.length} release badge{releaseBadges.length !== 1 ? 's' : ''}
            </p>
            <BadgeList badges={releaseBadges} size="xs" />
          </div>
        )}
      </div>
    </div>
  )
}
