import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/send'

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
  const hashedIp = await hashIp(ip)
  const ipLimited = await checkRateLimit(hashedIp, 'password_reset', 10, 1)
  if (ipLimited) return ipLimited
  const emailLimited = await checkRateLimit(email, 'password_reset', 3, 1)
  if (emailLimited) return emailLimited

  const { data: linkData, error: linkErr } = await getAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=/settings/security`,
    },
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ sent: true })
  }

  const tokenHash = linkData.properties.hashed_token
  const resetLink = `${SITE_URL}/auth/callback?next=/settings/security&token_hash=${tokenHash}&type=recovery`

  await sendEmail(email, 'Reset your Insound password', `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0A0A;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;text-align:center">
        <h1 style="color:#FAFAFA;font-size:20px;margin-bottom:8px">Reset your password</h1>
        <p style="color:#A1A1AA;font-size:14px;margin-bottom:24px">Click the button below to set a new password.</p>
        <a href="${resetLink}" style="display:inline-block;background:#F56D00;color:#000;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;letter-spacing:0.05em;text-transform:uppercase">Reset Password &rarr;</a>
        <p style="color:#52525B;font-size:12px;margin-top:24px">If you didn't request this, you can ignore this email.</p>
      </div>
    </div>
  `)

  return NextResponse.json({ sent: true })
}
