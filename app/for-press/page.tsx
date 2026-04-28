import type { Metadata } from 'next'
import { ForPressClient } from './ForPressClient'

export const metadata: Metadata = {
  title: 'For Press - insound.',
  description: 'The platform built on what Bandcamp forgot. Direct-to-fan music platform for independent artists - launching 2026.',
}

export default function ForPressPage() {
  return <ForPressClient />
}
