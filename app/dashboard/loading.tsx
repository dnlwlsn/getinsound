export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex bg-insound-bg text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="flex items-center justify-between mb-12">
          <div className="h-7 w-24 bg-zinc-900 rounded animate-pulse" />
          <div className="h-6 w-6 bg-zinc-900 rounded-full animate-pulse" />
        </div>
        <nav className="space-y-2 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full bg-zinc-900 rounded-lg animate-pulse" />
          ))}
        </nav>
        <div className="pt-6 border-t border-zinc-900">
          <div className="h-4 w-20 bg-zinc-900 rounded animate-pulse" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <div>
              <div className="h-4 w-28 bg-zinc-900 rounded animate-pulse mb-2" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-48 bg-zinc-800 rounded animate-pulse" />
                <div className="h-8 w-28 bg-zinc-900 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="h-12 w-40 bg-zinc-900 rounded-xl animate-pulse" />
          </header>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 h-24 animate-pulse">
                <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
                <div className="h-7 w-16 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>

          {/* Releases section */}
          <div className="mb-10">
            <div className="h-7 w-32 bg-zinc-900 rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex items-center gap-5 animate-pulse">
                  <div className="h-16 w-16 bg-zinc-800 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-40 bg-zinc-800 rounded" />
                    <div className="h-3 w-24 bg-zinc-800/60 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-zinc-800 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Fans / bottom section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 w-24 bg-zinc-800 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-zinc-800 rounded-full" />
                    <div className="h-4 w-32 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 w-28 bg-zinc-800 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 w-full bg-zinc-800 rounded" />
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
