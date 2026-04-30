import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.artist_id || typeof body.artist_id !== 'string') {
    return NextResponse.json({ error: 'artist_id required' }, { status: 400 })
  }

  if (body.artist_id === user.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  const { count: artistExists } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true })
    .eq('id', body.artist_id)

  if (!artistExists) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('fan_follows')
    .insert({ user_id: user.id, artist_id: body.artist_id })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: fan } = await supabase
    .from('fan_profiles')
    .select('username, is_public')
    .eq('id', user.id)
    .maybeSingle()

  const fanLabel = fan?.is_public && fan.username ? fan.username : 'A new fan'

  await createNotification({
    supabase,
    userId: body.artist_id,
    type: 'new_follower',
    title: `${fanLabel} started following you`,
    link: fan?.is_public && fan.username ? `/@${fan.username}` : undefined,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.artist_id || typeof body.artist_id !== 'string') {
    return NextResponse.json({ error: 'artist_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fan_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('artist_id', body.artist_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
