import type { Metadata } from 'next'
import { Suspense } from 'react'
import ReleaseClient from './ReleaseClient'

export const metadata: Metadata = {
  title: 'Release | insound.',
  description:
    'Buy music directly from the artist. 90% of every sale goes to the creator.',
  openGraph: {
    title: 'Release | insound.',
    description:
      'Buy music directly from the artist. 90% of every sale goes to the creator.',
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
