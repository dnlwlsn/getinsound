import type { Metadata } from 'next'
import { ForFansClient } from './ForFansClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'For Fans — insound.',
  description: 'Your £10 can change an artist\'s year. We only take 10%. Every fee shown transparently. No subscriptions, no algorithms.',
}

export default function ForFansPage() {
  return <ForFansClient />
}
