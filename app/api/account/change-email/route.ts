import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireFreshAuth } from '@/lib/fresh-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/send'

export const runtime = 'edge'
function getAdminClient() { return createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const freshAuthError = await requireFreshAuth(request)
  if (freshAuthError) return freshAuthError

  const rateLimited = await checkRateLimit(user.id, 'email_change', 1, 24)
  if (rateLimited) return rateLimited

  const { newEmail } = await request.json()
  const email = (newEmail as string)?.trim()?.toLowerCase()

  if (!email || !email.includes('@') || email.length < 5) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ error: 'New email is the same as current' }, { status: 400 })
  }

  const { error } = await getAdminClient().auth.admin.updateUserById(user.id, { email })
  if (error) {
    console.error('Email change failed:', error.message)
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 })
  }

  const oldEmail = user.email
  await sendEmail(
    oldEmail,
    'Your Insound email has been changed',
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          Your Insound email has been changed to <strong>${email}</strong>.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If this wasn't you, please contact us immediately at support@getinsound.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  )

  return NextResponse.json({ ok: true })
}
