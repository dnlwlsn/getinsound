export default function ArtistProfileLoading() {
  return (
    <div className="min-h-screen font-display pb-24">
      {/* Banner */}
      <div className="w-full h-48 md:h-64 bg-zinc-900 animate-pulse" />

      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-16 relative">
        {/* Avatar */}
        <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-[#09090b] animate-pulse mb-4" />

        {/* Name + bio */}
        <div className="w-48 h-8 bg-zinc-900 rounded animate-pulse mb-3" />
        <div className="w-72 h-4 bg-zinc-900 rounded animate-pulse mb-2" />
        <div className="w-56 h-4 bg-zinc-900 rounded animate-pulse mb-10" />

        {/* Release grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 mb-4 animate-pulse" />
              <div className="w-3/4 h-4 bg-zinc-900 rounded animate-pulse mb-2" />
              <div className="w-1/2 h-3 bg-zinc-900 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
