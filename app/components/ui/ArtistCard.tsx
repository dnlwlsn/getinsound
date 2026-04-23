import { Badge } from './Badge'
import { VerifiedTick } from './VerifiedTick'

type Props = {
  avatar: string
  name: string
  genre: string
  releaseCount: number
  badge?: { badge_type: string; metadata?: { position?: number } | null } | null
  verified?: boolean
  className?: string
}

export function ArtistCard({ avatar, name, genre, releaseCount, badge, verified, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl
      bg-white/[0.02] ring-1 ring-white/[0.06]
      hover:ring-white/[0.12] transition-all duration-150


      ${className}`}
    >
      <img
        src={avatar}
        alt={name}
        className="w-12 h-12 rounded-full object-cover ring-1 ring-white/[0.1]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-display font-bold text-sm text-white truncate
">
            {name}
          </p>
          {verified && <VerifiedTick size={14} />}
          {badge && <Badge type={badge.badge_type} position={badge.metadata?.position} size="xs" />}
        </div>
        <p className="text-xs text-zinc-500 truncate">{genre}</p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
        {releaseCount} {releaseCount === 1 ? 'release' : 'releases'}
      </span>
    </div>
  )
}
