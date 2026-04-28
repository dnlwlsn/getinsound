import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { ReportsClient } from './ReportsClient'

export const metadata: Metadata = {
  title: 'Reports — Admin — Insound',
}

export default async function ReportsPage() {
  await requireAdmin()
  return <ReportsClient />
}
