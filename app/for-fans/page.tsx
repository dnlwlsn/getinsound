import type { Metadata } from 'next'
import { ForFansClient } from './ForFansClient'

export const metadata: Metadata = {
  title: 'For Fans - insound.',
  description: 'Your £10 means £9 to the artist. We only take 10% - and absorb all processing fees. No subscriptions, no algorithms.',
}

export default function ForFansPage() {
  return <ForFansClient />
}
