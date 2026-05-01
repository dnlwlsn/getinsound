import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSession, setSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const existingSessionId = req.cookies.get('session_id')?.value
  if (existingSessionId) {
    return NextResponse.json({ ok: true })
  }

  const session = await createSession(user.id, req.headers)
  if (!session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  setSessionCookie(response, session.sessionId)
  return response
}
