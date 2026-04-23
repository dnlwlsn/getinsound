import { requireAdmin } from '@/lib/admin'
import { FlagsClient } from './FlagsClient'

export const metadata = { title: 'Security Flags — Admin — Insound' }

export default async function FlagsPage() {
  await requireAdmin()
  return <FlagsClient />
}
