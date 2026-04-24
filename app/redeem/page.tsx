import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RedeemClient } from './RedeemClient'

export const metadata: Metadata = {
  title: 'Redeem | insound.',
  description: 'Redeem a download code for a free release.',
  openGraph: {
    title: 'Redeem | insound.',
    description: 'Redeem a download code for a free release.',
    type: 'website',
  },
}

export default function RedeemPage() {
  return (
    <Suspense fallback={null}>
      <RedeemClient />
    </Suspense>
  )
}
