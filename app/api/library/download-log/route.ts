import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


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

  await supabase.from('download_events').insert({
    user_id: user.id,
    release_id: releaseId,
    format,
    track_count: trackCount ?? 1,
  })

  return NextResponse.json({ ok: true })
}
