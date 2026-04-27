import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('favourites')
    .select('id, track_id, release_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { track_id, release_id } = body

  if (!track_id && !release_id) {
    return NextResponse.json({ error: 'track_id or release_id required' }, { status: 400 })
  }
  if (track_id && release_id) {
    return NextResponse.json({ error: 'Provide track_id or release_id, not both' }, { status: 400 })
  }

  const row: Record<string, string> = { user_id: user.id }
  if (track_id) row.track_id = track_id
  if (release_id) row.release_id = release_id

  const { error } = await supabase.from('favourites').insert(row)

  if (error?.code === '23505') return NextResponse.json({ ok: true, already: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { track_id, release_id } = body

  if (!track_id && !release_id) {
    return NextResponse.json({ error: 'track_id or release_id required' }, { status: 400 })
  }

  let query = supabase.from('favourites').delete().eq('user_id', user.id)
  if (track_id) query = query.eq('track_id', track_id)
  if (release_id) query = query.eq('release_id', release_id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
