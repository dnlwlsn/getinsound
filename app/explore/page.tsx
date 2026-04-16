import type { Metadata } from 'next'
import ExploreClient from './ExploreClient'

export const metadata: Metadata = {
  title: 'Explore | insound.',
  description:
    'Explore thousands of tracks from independent artists. Buy direct, pay fair — artists earn 90% of every sale on Insound.',
  openGraph: {
    title: 'Explore | insound.',
    description:
      'Explore thousands of tracks from independent artists. Buy direct, pay fair — artists earn 90% of every sale on Insound.',
    type: 'website',
  },
}

export default function ExplorePage() {
  return <ExploreClient />
}
