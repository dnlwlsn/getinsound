import type { Metadata } from 'next'
import ExploreClient from './ExploreClient'

export const metadata: Metadata = {
  title: 'Explore | insound.',
  description:
    'Explore thousands of tracks from independent artists. Buy direct, pay fair — we only take 10%. Every fee shown transparently at checkout.',
  openGraph: {
    title: 'Explore | insound.',
    description:
      'Explore thousands of tracks from independent artists. Buy direct, pay fair — we only take 10%. Every fee shown transparently at checkout.',
    type: 'website',
  },
}

export default function ExplorePage() {
  return <ExploreClient />
}
