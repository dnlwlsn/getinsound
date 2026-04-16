import type { Metadata } from 'next'
import { ForArtistsClient } from './ForArtistsClient'

export const metadata: Metadata = {
  title: 'For Artists — insound.',
  description: 'Your music. Your money. Permanently. 90% to you, always. No monthly fee. Own your masters.',
}

export default function ForArtistsPage() {
  return <ForArtistsClient />
}
