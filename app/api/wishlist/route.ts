import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fan_wishlist')
    .select(`
      id, created_at, release_id,
      releases (
        id, slug, title, type, cover_url, price_pence, currency,
        artists ( slug, name, accent_colour )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { release_id } = await req.json()
  if (!release_id) return NextResponse.json({ error: 'release_id required' }, { status: 400 })

  const { error } = await supabase
    .from('fan_wishlist')
    .insert({ user_id: user.id, release_id })

  if (error?.code === '23505') {
    return NextResponse.json({ ok: true, already: true })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { release_id } = await req.json()
  if (!release_id) return NextResponse.json({ error: 'release_id required' }, { status: 400 })

  const { error } = await supabase
    .from('fan_wishlist')
    .delete()
    .eq('user_id', user.id)
    .eq('release_id', release_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
