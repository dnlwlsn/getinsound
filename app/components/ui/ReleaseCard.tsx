import { VerifiedTick } from './VerifiedTick'

type Props = {
  artwork: string
  title: string
  artist: string
  price: string
  tags?: string[]
  verified?: boolean
  className?: string
}

export function ReleaseCard({ artwork, title, artist, price, tags, verified, className = '' }: Props) {
  return (
    <div className={`group cursor-pointer ${className}`}>
      <div className="aspect-square rounded-2xl overflow-hidden mb-3 ring-1 ring-white/[0.06]
">
        <img
          src={artwork}
          alt={`${title} by ${artist}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <p className="font-display font-bold text-sm text-white truncate
">
        {title}
      </p>
      <span className="flex items-center gap-1 mt-0.5">
        <p className="text-xs text-zinc-500 truncate">{artist}</p>
        {verified && <VerifiedTick size={12} />}
      </span>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-800/60 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <span className="inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider
        bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 rounded-full">
        {price}
      </span>
    </div>
  )
}
