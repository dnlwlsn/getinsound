import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const FRESH_AUTH_WINDOW_MS = 15 * 60 * 1000

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function requireFreshAuth(
  request: NextRequest,
): Promise<NextResponse | null> {
  const sessionId = request.cookies.get('session_id')?.value
  if (!sessionId) {
    return NextResponse.json(
      { error: 'No session', code: 'FRESH_AUTH_REQUIRED' },
      { status: 403 },
    )
  }

  const { data: session } = await supabaseAdmin
    .from('user_sessions')
    .select('last_verified_at')
    .eq('id', sessionId)
    .single()

  if (!session?.last_verified_at) {
    return NextResponse.json(
      { error: 'Identity verification required', code: 'FRESH_AUTH_REQUIRED' },
      { status: 403 },
    )
  }

  const verifiedAt = new Date(session.last_verified_at).getTime()
  if (Date.now() - verifiedAt > FRESH_AUTH_WINDOW_MS) {
    return NextResponse.json(
      { error: 'Identity verification expired', code: 'FRESH_AUTH_REQUIRED' },
      { status: 403 },
    )
  }

  return null
}
