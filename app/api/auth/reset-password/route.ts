import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = (body?.email as string)?.trim()?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const ip = getClientIp(req.headers)
  const ipLimited = await checkRateLimit(ip, 'password_reset', 10, 1)
  if (ipLimited) return ipLimited
  const emailLimited = await checkRateLimit(email, 'password_reset', 3, 1)
  if (emailLimited) return emailLimited

  await getAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=/`,
    },
  })

  return NextResponse.json({ sent: true })
}
