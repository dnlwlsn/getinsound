type Props = {
  artwork: string
  title: string
  artist: string
  price: string
  className?: string
}

export function ReleaseCard({ artwork, title, artist, price, className = '' }: Props) {
  return (
    <div className={`group cursor-pointer ${className}`}>
      <div className="aspect-square rounded-2xl overflow-hidden mb-3 ring-1 ring-white/[0.06]
        [html[data-theme=light]_&]:ring-zinc-200">
        <img
          src={artwork}
          alt={`${title} by ${artist}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <p className="font-display font-bold text-sm text-white truncate
        [html[data-theme=light]_&]:text-zinc-900">
        {title}
      </p>
      <p className="text-xs text-zinc-500 truncate mt-0.5">{artist}</p>
      <span className="inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider
        bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 rounded-full">
        {price}
      </span>
    </div>
  )
}
