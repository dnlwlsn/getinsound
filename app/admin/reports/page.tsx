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

  let { data, error } = await supabase
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
    console.error('Reports fetch error:', error)
    const fallback = await supabase
      .from('profile_reports')
      .select('*')
      .order('created_at', { ascending: false })

    const rows = fallback.data || []
    const artistIds = [...new Set(rows.map((r: any) => r.reported_artist_id).filter(Boolean))]
    const fanIds = [...new Set([
      ...rows.map((r: any) => r.reported_fan_id),
      ...rows.map((r: any) => r.reporter_id),
    ].filter(Boolean))]

    const [{ data: artists }, { data: fans }] = await Promise.all([
      artistIds.length > 0
        ? supabase.from('artists').select('id, name, slug').in('id', artistIds)
        : Promise.resolve({ data: [] as any[] }),
      fanIds.length > 0
        ? supabase.from('fan_profiles').select('id, username, avatar_url').in('id', fanIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const artistMap = new Map((artists || []).map((a: any) => [a.id, a]))
    const fanMap = new Map((fans || []).map((f: any) => [f.id, f]))

    data = rows.map((d: any) => {
      const a = artistMap.get(d.reported_artist_id)
      const f = fanMap.get(d.reported_fan_id)
      const r = fanMap.get(d.reporter_id)
      return {
        ...d,
        reporter: r ? { username: r.username } : null,
        reported_artist: a ? { name: a.name, slug: a.slug } : null,
        reported_fan: f ? { username: f.username, avatar_url: f.avatar_url } : null,
      }
    })
    error = fallback.error
  }

  return <ReportsClient initialReports={(data || []) as any} fetchError={error?.message || null} />
}
