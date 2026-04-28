export default function DiscoverLoading() {
  return (
    <div className="min-h-screen font-display pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="w-48 h-10 bg-zinc-900 rounded animate-pulse mb-3" />
        <div className="w-64 h-4 bg-zinc-900 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
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
