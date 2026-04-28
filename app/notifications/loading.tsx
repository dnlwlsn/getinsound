export default function NotificationsLoading() {
  return (
    <div className="min-h-screen font-display pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="w-40 h-8 bg-zinc-900 rounded animate-pulse mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
              <div className="flex-1">
                <div className="w-3/4 h-4 bg-zinc-800 rounded mb-2" />
                <div className="w-1/2 h-3 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
