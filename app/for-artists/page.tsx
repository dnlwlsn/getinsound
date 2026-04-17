import type { Metadata } from 'next'
import { ForArtistsClient } from './ForArtistsClient'

export const metadata: Metadata = {
  title: 'For Artists — insound.',
  description: 'Your music. Your money. Permanently. We take 10%, Stripe takes 1.5% + 20p, you keep the rest. No monthly fee. Own your masters.',
}

export default function ForArtistsPage() {
  return <ForArtistsClient />
}
