export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-40">
        <div className="h-8 w-40 bg-zinc-800 rounded-lg animate-pulse mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex gap-4">
              <div className="w-20 h-20 rounded-xl bg-zinc-800 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-32 bg-zinc-800/60 rounded animate-pulse" />
                <div className="h-3 w-24 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
