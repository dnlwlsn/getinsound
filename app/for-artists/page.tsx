import type { Metadata } from 'next'
import { ForArtistsClient } from './ForArtistsClient'

export const metadata: Metadata = {
  title: 'For Artists - insound.',
  description: 'Your music. Your money. Permanently. You keep 90% - we absorb all processing fees. No surprises. No monthly fee. Own your masters.',
}

export default function ForArtistsPage() {
  return <ForArtistsClient />
}
