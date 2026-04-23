import type { Metadata } from 'next'
import { Suspense } from 'react'
import DownloadClient from './DownloadClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Download | insound.',
  description: 'Your Insound download.',
  openGraph: {
    title: 'Download | insound.',
    description: 'Your Insound download.',
    type: 'website',
  },
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">
            Finalising
          </p>
          <h1 className="text-2xl font-black mb-2 font-display">
            Preparing your download...
          </h1>
          <p className="text-zinc-500 font-medium text-sm">
            This usually takes a few seconds after payment.
          </p>
        </div>
      }
    >
      <DownloadClient />
    </Suspense>
  )
}
