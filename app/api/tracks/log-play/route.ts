import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { trackId, isPreview } = await request.json()

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 })
    }
    if (typeof isPreview !== 'boolean') {
      return NextResponse.json({ error: 'isPreview required' }, { status: 400 })
    }

    const supabase = await createClient()

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
