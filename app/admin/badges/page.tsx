import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { BadgesClient } from './BadgesClient'

export const metadata: Metadata = {
  title: 'Badges — Admin | Insound',
}

export default async function BadgesPage() {
  await requireAdmin()
  return <BadgesClient />
}
