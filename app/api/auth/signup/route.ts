import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildMagicLinkEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = (body.email as string)?.trim()?.toLowerCase()
  const nextPath = typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/') && !body.redirectTo.startsWith('//') && !body.redirectTo.includes('\\') ? body.redirectTo : '/welcome'

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const ipLimited = await checkRateLimit(ipHash, 'signup', 10, 1)
  if (ipLimited) return ipLimited

  const rateLimited = await checkRateLimit(email, 'signup', 3, 5)
  if (rateLimited) return rateLimited

  const admin = getAdminClient()

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (linkErr) {
    console.error('[signup] generateLink failed:', linkErr.message)
    if (linkErr.message?.includes('already registered')) {
      return NextResponse.json({ error: 'already_registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const tokenHash = linkData.properties?.hashed_token

  if (!tokenHash) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const magicLink = `${SITE_URL}/auth/callback?next=${encodeURIComponent(nextPath)}&token_hash=${tokenHash}&type=magiclink`
  const { subject, html } = buildMagicLinkEmail(magicLink, 'signin')
  const result = await sendEmail(email, subject, html)

  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
