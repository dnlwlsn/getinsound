import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSession, setSessionCookie } from '@/lib/session'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/welcome'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const response = NextResponse.redirect(`${origin}${next}`)

      const session = await createSession(data.user.id, request.headers)
      if (session) {
        setSessionCookie(response, session.sessionId)
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/signup?error=auth`)
}
