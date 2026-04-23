import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

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

  // Upsert fan_profiles row
  const { error: profileErr } = await supabase
    .from('fan_profiles')
    .upsert({
      id: user.id,
      preferences_skipped: skip === true,
    }, { onConflict: 'id' })

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // If skipping, we're done
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
  await supabase.from('fan_preferences').delete().eq('user_id', user.id)

  const { error: insertErr } = await supabase
    .from('fan_preferences')
    .insert(genres.map(genre => ({ user_id: user.id, genre })))

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
