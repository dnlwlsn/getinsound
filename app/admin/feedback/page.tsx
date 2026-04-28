import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { FeedbackClient } from './FeedbackClient'

export const metadata: Metadata = {
  title: 'Feedback — Admin — Insound',
}

export default async function FeedbackPage() {
  await requireAdmin()
  return <FeedbackClient />
}
