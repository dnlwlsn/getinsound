import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redeemTransferCode } from '@/lib/auth-transfer'
import { createSession, setSessionCookie } from '@/lib/session'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rateLimited = await checkRateLimit(ip, 'auth_transfer', 5, 0.25)
  if (rateLimited) return rateLimited

  const body = await req.json().catch(() => null)
  if (!body?.code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const userId = await redeemTransferCode(body.code)
  if (!userId) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: (await admin.auth.admin.getUserById(userId)).data.user?.email || '',
  })

  if (linkErr || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const tokenHash = linkData.properties.hashed_token

  const response = NextResponse.json({ ok: true, token_hash: tokenHash })

  const session = await createSession(userId, req.headers)
  if (session) setSessionCookie(response, session.sessionId)

  return response
}
