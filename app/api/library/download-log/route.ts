import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function POST(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { releaseId, format, trackCount } = body

  if (!releaseId || !format) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const validFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'original']
  if (!validFormats.includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }
  const safeTrackCount = Math.max(1, Math.min(200, Number.isInteger(trackCount) ? trackCount : 1))

  const { count } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_user_id', user.id)
    .eq('release_id', releaseId)
    .eq('status', 'paid')
    .or('pre_order.eq.false,pre_order.is.null')

  if (!count || count === 0) {
    return NextResponse.json({ error: 'No purchase found' }, { status: 403 })
  }

  const { error: insertErr } = await supabase.from('download_events').insert({
    user_id: user.id,
    release_id: releaseId,
    format,
    track_count: safeTrackCount,
  })

  if (insertErr) console.error('[download-log] insert failed:', insertErr.message)

  return NextResponse.json({ ok: true })
}
