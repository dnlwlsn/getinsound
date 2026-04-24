import type { Metadata } from 'next'
import { WhyUsClient } from './WhyUsClient'

export const metadata: Metadata = {
  title: 'Why Insound? | The Math of Independence',
  description: 'See exactly why independent artists earn more on Insound. Compare streaming royalties to direct sales — the math speaks for itself.',
  openGraph: {
    title: 'Why Insound? | The Math of Independence',
    description: 'See exactly why independent artists earn more on Insound. Compare streaming royalties to direct sales — the math speaks for itself.',
    type: 'website',
  },
}

export default function WhyUsPage() {
  return <WhyUsClient />
}
