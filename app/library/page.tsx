import type { Metadata } from 'next'
import LibraryClient from './LibraryClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'My Collection | Insound',
  description:
    'Your Insound music collection. Every purchase pays the artist directly — browse, play, and revisit your library.',
  openGraph: {
    title: 'My Collection | Insound',
    description:
      'Your Insound music collection. Every purchase pays the artist directly — browse, play, and revisit your library.',
    type: 'website',
  },
}

export default function LibraryPage() {
  return <LibraryClient />
}
