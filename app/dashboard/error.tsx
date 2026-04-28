'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-insound-bg flex items-center justify-center p-6 font-display">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 mb-4">Error</p>
        <h1 className="text-2xl font-black text-zinc-100 mb-3">We couldn&apos;t load your dashboard.</h1>
        <p className="text-sm text-zinc-500 mb-6">Try refreshing, or contact us if it keeps happening.</p>
        <button
          onClick={reset}
          className="bg-orange-600 text-black font-black px-6 py-3 rounded-xl text-sm hover:bg-orange-500 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
