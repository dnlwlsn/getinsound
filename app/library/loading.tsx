export default function LibraryLoading() {
  return (
    <div className="min-h-screen font-display pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <div className="w-20 h-3 bg-zinc-900 rounded animate-pulse mb-4" />
            <div className="w-48 h-12 bg-zinc-900 rounded animate-pulse mb-3" />
            <div className="w-56 h-4 bg-zinc-900 rounded animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="w-36 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
            <div className="w-36 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <div className="w-28 h-9 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="w-28 h-9 bg-zinc-900 rounded-xl animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="w-32 h-9 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="w-20 h-9 bg-zinc-900 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 mb-4 animate-pulse" />
              <div className="w-3/4 h-4 bg-zinc-900 rounded animate-pulse mb-2" />
              <div className="w-1/2 h-3 bg-zinc-900 rounded animate-pulse mb-2" />
              <div className="flex justify-between">
                <div className="w-16 h-3 bg-zinc-900 rounded animate-pulse" />
                <div className="w-12 h-3 bg-zinc-900 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
