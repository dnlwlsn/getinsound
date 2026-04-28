import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: reports, error } = await supabase
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: reports || [] })
}
