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

  // Clear any old preferences, then insert new ones
  const { error: deleteErr } = await supabase.from('fan_preferences').delete().eq('user_id', user.id)

  if (deleteErr) {
    console.error('[fan-preferences] delete failed:', deleteErr.message, deleteErr.code)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  const { error: insertErr } = await supabase
    .from('fan_preferences')
    .insert(genres.map(genre => ({ user_id: user.id, genre })))

  if (insertErr) {
    console.error('[fan-preferences] insert failed:', insertErr.message, insertErr.code)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
