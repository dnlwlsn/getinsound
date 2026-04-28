export default function SettingsLoading() {
  return (
    <div className="min-h-screen font-display pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="w-32 h-8 bg-zinc-900 rounded animate-pulse mb-8" />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse">
              <div className="w-1/3 h-5 bg-zinc-800 rounded mb-4" />
              <div className="w-full h-10 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
