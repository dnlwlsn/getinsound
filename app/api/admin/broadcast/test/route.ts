import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { sendEmail } from '@/lib/email/send'
import { buildBroadcastHtml } from '@/lib/email/broadcast'

export const runtime = 'edge'
export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { subject, body_markdown, test_email } = await req.json()

  if (!subject || !body_markdown) {
    return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })
  }

  const to = test_email || user.email!
  const html = buildBroadcastHtml(body_markdown)
  const result = await sendEmail(to, `[TEST] ${subject}`, html)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent_to: to })
}
