import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabaseAdmin
    .from('fan_badges')
    .select('id, user_id, badge_type, awarded_at, metadata, fan_profiles (username, avatar_url)')
    .in('badge_type', ['beta_tester', 'founder'])
    .order('awarded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ badges: data })
}

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, badge_type } = await req.json().catch(() => ({} as any))
  if (!username || !badge_type) {
    return NextResponse.json({ error: 'username and badge_type required' }, { status: 400 })
  }
  if (!['beta_tester', 'founder'].includes(badge_type)) {
    return NextResponse.json({ error: 'Invalid badge type' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: fan } = await supabaseAdmin
    .from('fan_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (!fan) return NextResponse.json({ error: 'Fan not found' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('fan_badges')
    .upsert(
      { user_id: fan.id, badge_type, awarded_at: new Date().toISOString() },
      { onConflict: 'user_id,badge_type' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { badge_id } = await req.json().catch(() => ({} as any))
  if (!badge_id) return NextResponse.json({ error: 'badge_id required' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabaseAdmin
    .from('fan_badges')
    .delete()
    .eq('id', badge_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
