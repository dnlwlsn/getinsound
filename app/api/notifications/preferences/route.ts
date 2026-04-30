import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('type, in_app, email')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ preferences: data ?? [] })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { preferences } = body as {
    preferences: { type: string; in_app: boolean; email: boolean }[]
  }

  if (!preferences || !Array.isArray(preferences)) {
    return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 })
  }

  const VALID_TYPES = ['new_release', 'new_follower', 'artist_post', 'purchase', 'order_update', 'milestone', 'system']

  const rows = preferences
    .filter(p => VALID_TYPES.includes(p.type))
    .map(p => ({
      user_id: user.id,
      type: p.type,
      in_app: p.in_app === true,
      email: p.email === true,
    }))

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,type' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
