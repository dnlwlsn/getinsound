import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createSession, setSessionCookie } from '@/lib/session'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'magiclink') as 'magiclink' | 'email'
  const nextParam = searchParams.get('next') ?? '/welcome'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/welcome'

  const supabase = await createClient()
  let user = null

  if (tokenHash) {
    const { error, data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error && data.user) user = data.user
  } else if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) user = data.user
  }

  if (user) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const existingSessionId = request.cookies.get('session_id')?.value
    let sessionId = existingSessionId

    if (!existingSessionId) {
      const session = await createSession(user.id, request.headers)
      if (session) {
        setSessionCookie(response, session.sessionId)
        sessionId = session.sessionId
      }
    }

    if (next.includes('reverified=1') && sessionId) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      await admin.rpc('verify_session', { p_session_id: sessionId })
    }

    return response
  }

  return NextResponse.redirect(`${origin}/signup?error=auth`)
}
