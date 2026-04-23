import type { Metadata } from 'next'
import { Suspense } from 'react'
import SearchClient from './SearchClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Search | insound.',
  description: 'Search for artists and releases on Insound.',
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-6 py-24 text-center text-zinc-600 font-bold text-sm">
          Loading...
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  )
}
