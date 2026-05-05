import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const { trackId, isPreview } = await request.json()

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 })
    }
    if (typeof isPreview !== 'boolean') {
      return NextResponse.json({ error: 'isPreview required' }, { status: 400 })
    }

    const ip = getClientIp(request.headers)
    const ipHash = await hashIp(ip)
    const rateLimited = await checkRateLimit(`${ipHash}:${trackId}`, 'log_play', 5, 1)
    if (rateLimited) return rateLimited

    const supabase = await createClient()

    const { data: track } = await supabase
      .from('tracks')
      .select('release_id, releases!inner(published)')
      .eq('id', trackId)
      .maybeSingle()

    if (!track || !(track.releases as any)?.published) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    const { error } = await supabase.rpc('increment_play_count', {
      track_id: trackId,
      is_preview: isPreview,
    })

    if (error) {
      console.error('Failed to log play:', error.message)
      return NextResponse.json({ error: 'Failed to log play' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
