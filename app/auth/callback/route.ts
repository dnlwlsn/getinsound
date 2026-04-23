import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createSession, setSessionCookie } from '@/lib/session'

export const runtime = 'edge'
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/welcome'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const response = NextResponse.redirect(`${origin}${next}`)

      const existingSessionId = request.cookies.get('session_id')?.value
      let sessionId = existingSessionId

      if (!existingSessionId) {
        const session = await createSession(data.user.id, request.headers)
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
  }

  return NextResponse.redirect(`${origin}/signup?error=auth`)
}
