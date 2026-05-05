import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redeemTransferCode } from '@/lib/auth-transfer'
import { createSession, setSessionCookie } from '@/lib/session'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const rateLimited = await checkRateLimit(ipHash, 'auth_transfer', 5, 0.25)
  if (rateLimited) return rateLimited

  const transferCode = req.cookies.get('auth_transfer_code')?.value
  if (!transferCode) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const userId = await redeemTransferCode(transferCode)
  if (!userId) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  if (!userData.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  })

  if (linkErr || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const tokenHash = linkData.properties.hashed_token

  const response = NextResponse.json({ ok: true, token_hash: tokenHash })

  response.cookies.set('auth_transfer_code', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth/transfer',
    maxAge: 0,
  })

  const session = await createSession(userId, req.headers)
  if (session) setSessionCookie(response, session.sessionId)

  return response
}
