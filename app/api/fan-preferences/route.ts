import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


import { SOUNDS_SET } from '@/lib/sounds'

const VALID_GENRES = SOUNDS_SET

/** POST /api/fan-preferences — save genre selections or skip */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { genres, skip } = body as { genres?: string[]; skip?: boolean }

  if (skip) {
    return NextResponse.json({ ok: true })
  }

  // Validate genres
  if (!Array.isArray(genres) || genres.length < 3 || genres.length > 5) {
    return NextResponse.json({ error: 'Select 3–5 genres' }, { status: 400 })
  }
  if (!genres.every(g => VALID_GENRES.has(g))) {
    return NextResponse.json({ error: 'Invalid genre' }, { status: 400 })
  }

  const { error: rpcErr } = await supabase.rpc('set_fan_preferences', {
    p_user_id: user.id,
    p_genres: genres,
  })

  if (rpcErr) {
    console.error('[fan-preferences] save failed:', rpcErr.message, rpcErr.code)
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
