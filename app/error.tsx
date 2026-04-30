'use client'

import Link from 'next/link'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-4">Error</p>
        <h1 className="text-2xl font-black mb-3">Something went wrong</h1>
        <p className="text-sm text-zinc-400 mb-6">Try refreshing the page, or come back in a moment.</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="bg-orange-600 text-black font-black py-3 px-6 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
          >
            Try Again
          </button>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
