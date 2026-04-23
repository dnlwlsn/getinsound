import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { releaseId, format, trackCount } = body

  if (!releaseId || !format) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await supabase.from('download_events').insert({
    user_id: user.id,
    release_id: releaseId,
    format,
    track_count: trackCount ?? 1,
  })

  return NextResponse.json({ ok: true })
}
