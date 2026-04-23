import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('id, device, ip_display, city, country, last_active_at, created_at')
    .eq('user_id', user.id)
    .order('last_active_at', { ascending: false })

  return NextResponse.json({ sessions: sessions || [] })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { sessionId, all } = await request.json()
  const currentSessionId = request.cookies.get('session_id')?.value

  if (all) {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', user.id)
      .neq('id', currentSessionId || '')
    return NextResponse.json({ ok: true })
  }

  if (sessionId === currentSessionId) {
    return NextResponse.json({ error: 'Cannot sign out current session' }, { status: 400 })
  }

  await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
