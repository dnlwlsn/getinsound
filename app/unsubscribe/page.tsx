import type { Metadata } from 'next'
import { Suspense } from 'react'
import { UnsubscribeClient } from './UnsubscribeClient'

export const metadata: Metadata = {
  title: 'Unsubscribe | Insound',
  description: 'Manage your Insound email preferences.',
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
          <p className="text-zinc-400 text-sm">Loading...</p>
        </div>
      }
    >
      <UnsubscribeClient />
    </Suspense>
  )
}
