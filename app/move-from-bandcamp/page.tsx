import type { Metadata } from 'next'
import { MoveFromBandcampClient } from './MoveFromBandcampClient'

export const metadata: Metadata = {
  title: 'Move from Bandcamp to Insound',
  description: 'A step-by-step guide to moving your music, fans, and sales from Bandcamp to Insound. Keep 90%, own your masters, no lock-in.',
}

export default function MoveFromBandcampPage() {
  return <MoveFromBandcampClient />
}
