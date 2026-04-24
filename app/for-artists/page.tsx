import type { Metadata } from 'next'
import { ForArtistsClient } from './ForArtistsClient'

export const metadata: Metadata = {
  title: 'For Artists — insound.',
  description: 'Your music. Your money. Permanently. We only take 10%. No surprises. No monthly fee. Own your masters.',
}

export default function ForArtistsPage() {
  return <ForArtistsClient />
}
