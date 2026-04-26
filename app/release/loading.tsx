export default function ReleaseLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-start">
        {/* Cover art */}
        <div className="aspect-square w-full rounded-3xl bg-zinc-900 border border-zinc-800 animate-pulse" />

        {/* Details */}
        <div>
          <div className="w-24 h-3 bg-zinc-900 rounded animate-pulse mb-4" />
          <div className="w-64 h-10 bg-zinc-900 rounded animate-pulse mb-3" />
          <div className="w-40 h-4 bg-zinc-900 rounded animate-pulse mb-8" />

          {/* Price */}
          <div className="w-32 h-10 bg-zinc-900 rounded animate-pulse mb-3" />
          <div className="w-full h-14 bg-zinc-900 rounded-2xl animate-pulse mb-10" />

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
