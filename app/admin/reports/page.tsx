import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { ReportsClient } from './ReportsClient'

export const metadata: Metadata = {
  title: 'Reports — Admin — Insound',
}

export default async function ReportsPage() {
  await requireAdmin()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await supabase
    .from('profile_reports')
    .select(`
      id, reported_profile_type, category, details, status,
      admin_notes, reviewed_by, reviewed_at, created_at,
      reported_artist_id, reported_fan_id,
      reporter:fan_profiles!reporter_id(username),
      reported_artist:artists!reported_artist_id(name, slug),
      reported_fan:fan_profiles!reported_fan_id(username, avatar_url)
    `)
    .order('created_at', { ascending: false })

  return <ReportsClient initialReports={(data || []) as any} />
}
