import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createSession, setSessionCookie } from '@/lib/session'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const existingSessionId = req.cookies.get('session_id')?.value
  if (existingSessionId) {
    const { data: existingSession } = await getAdminClient()
      .from('user_sessions')
      .select('id')
      .eq('id', existingSessionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingSession) {
      return NextResponse.json({ ok: true })
    }
  }

  const session = await createSession(user.id, req.headers)
  if (!session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  setSessionCookie(response, session.sessionId)
  return response
}
