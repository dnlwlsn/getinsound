import type { Metadata } from 'next'
import { Suspense } from 'react'
import PlayerClient from './PlayerClient'

export const metadata: Metadata = {
  title: 'Now Playing | insound.',
  description:
    'Listen to independent music on Insound. Artists keep 90% of every sale — discover and support music that matters.',
  openGraph: {
    title: 'Now Playing | insound.',
    description:
      'Listen to independent music on Insound. Artists keep 90% of every sale — discover and support music that matters.',
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
