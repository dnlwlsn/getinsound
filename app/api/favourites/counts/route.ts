import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!artist) {
    return NextResponse.json({ error: 'Not an artist' }, { status: 403 })
  }

  const { data: releases } = await supabase
    .from('releases')
    .select('id, tracks(id)')
    .eq('artist_id', user.id)

  if (!releases || releases.length === 0) {
    return NextResponse.json({ releases: {}, tracks: {} })
  }

  const releaseIds = releases.map(r => r.id)
  const trackIds = releases.flatMap(r => (r.tracks || []).map((t: any) => t.id))

  const [relCounts, trkCounts] = await Promise.all([
    supabase.from('release_favourite_counts').select('release_id, save_count').in('release_id', releaseIds),
    trackIds.length > 0
      ? supabase.from('track_favourite_counts').select('track_id, save_count').in('track_id', trackIds)
      : Promise.resolve({ data: [] as { track_id: string; save_count: number }[] }),
  ])

  const releaseMap: Record<string, number> = {}
  for (const r of relCounts.data || []) releaseMap[r.release_id] = r.save_count

  const trackMap: Record<string, number> = {}
  for (const t of (trkCounts as any).data || []) trackMap[t.track_id] = t.save_count

  return NextResponse.json({ releases: releaseMap, tracks: trackMap })
}
