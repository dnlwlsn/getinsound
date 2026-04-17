import type { Metadata } from 'next'
import ExploreClient from './ExploreClient'

export const metadata: Metadata = {
  title: 'Explore | insound.',
  description:
    'Explore thousands of tracks from independent artists. Buy direct, pay fair — we take 10%, Stripe takes 1.5% + 20p, artists keep the rest.',
  openGraph: {
    title: 'Explore | insound.',
    description:
      'Explore thousands of tracks from independent artists. Buy direct, pay fair — we take 10%, Stripe takes 1.5% + 20p, artists keep the rest.',
    type: 'website',
  },
}

export default function ExplorePage() {
  return <ExploreClient />
}
