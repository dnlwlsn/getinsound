'use client'

export default function LibraryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 font-display">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 mb-4">Error</p>
        <h1 className="text-2xl font-black text-zinc-100 mb-3">Something went wrong.</h1>
        <p className="text-sm text-zinc-500 mb-6">We couldn&apos;t load your library.</p>
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
