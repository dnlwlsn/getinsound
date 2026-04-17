import type { Metadata } from 'next'
import { Suspense } from 'react'
import PlayerClient from './PlayerClient'

export const metadata: Metadata = {
  title: 'Now Playing | insound.',
  description:
    'Listen to independent music on Insound. We take 10%, Stripe takes 1.5% + 20p, artists keep the rest — discover and support music that matters.',
  openGraph: {
    title: 'Now Playing | insound.',
    description:
      'Listen to independent music on Insound. We take 10%, Stripe takes 1.5% + 20p, artists keep the rest — discover and support music that matters.',
    type: 'music.song',
  },
}

export default function PlayerPage() {
  return (
    <Suspense>
      <PlayerClient />
    </Suspense>
  )
}
