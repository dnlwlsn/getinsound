export default function ReleaseLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-10 md:py-14">
      <div className="flex flex-col sm:flex-row gap-8 md:gap-10 items-start">
        {/* Cover art */}
        <div className="w-full max-w-[280px] mx-auto sm:mx-0 sm:w-56 md:w-64 shrink-0">
          <div className="aspect-square w-full rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="w-24 h-3 bg-zinc-900 rounded animate-pulse mb-4" />
          <div className="w-64 h-10 bg-zinc-900 rounded animate-pulse mb-3" />
          <div className="w-40 h-4 bg-zinc-900 rounded animate-pulse mb-8" />

          {/* Price */}
          <div className="w-32 h-10 bg-zinc-900 rounded animate-pulse mb-3" />
          <div className="w-full sm:w-48 h-14 bg-zinc-900 rounded-2xl animate-pulse mb-10" />

          {/* Tracklist */}
          <div className="border-t border-zinc-800 pt-6">
            <div className="w-20 h-3 bg-zinc-900 rounded animate-pulse mb-4" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <div className="w-6 h-3 bg-zinc-900 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-zinc-900 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
