import type { Metadata } from 'next'
import { ForFansClient } from './ForFansClient'

export const metadata: Metadata = {
  title: 'For Fans — insound.',
  description: 'Your £10 can change an artist\'s year. We take 10%, Stripe takes 1.5% + 20p, the rest goes to the artist. No subscriptions, no algorithms.',
}

export default function ForFansPage() {
  return <ForFansClient />
}
