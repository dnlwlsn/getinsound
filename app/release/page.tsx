import type { Metadata } from 'next'
import { Suspense } from 'react'
import ReleaseClient from './ReleaseClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Release | insound.',
  description:
    'Buy music directly from the artist. We only take 10%. Every fee shown transparently at checkout.',
  openGraph: {
    title: 'Release | insound.',
    description:
      'Buy music directly from the artist. We only take 10%. Every fee shown transparently at checkout.',
    type: 'website',
  },
}

export default function ReleasePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-6 py-24 text-center text-zinc-600 font-bold text-sm">
          Loading...
        </div>
      }
    >
      <ReleaseClient />
    </Suspense>
  )
}
