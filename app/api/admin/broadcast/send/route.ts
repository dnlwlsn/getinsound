import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'
import { sendEmail } from '@/lib/email/send'
import { buildBroadcastHtml } from '@/lib/email/broadcast'

function getAdminClient() { return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) }

async function getUnsubscribedIds(): Promise<Set<string>> {
  const { data } = await getAdminClient()
    .from('fan_profiles')
    .select('id')
    .eq('email_unsubscribed', true)
  return new Set((data ?? []).map(r => r.id))
}

async function getAllUsers() {
  const allUsers: { id: string; email?: string }[] = []
  let page = 1
  while (true) {
    const { data } = await getAdminClient().auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users ?? []
    if (users.length === 0) break
    allUsers.push(...users.map(u => ({ id: u.id, email: u.email })))
    if (users.length < 1000) break
    page++
  }
  return allUsers
}

async function getRecipientEmails(audience: string): Promise<string[]> {
  const unsubscribed = await getUnsubscribedIds()

  if (audience === 'artists') {
    const { data } = await getAdminClient().from('artist_accounts').select('email')
    return (data ?? []).map(r => r.email).filter(Boolean)
  }

  if (audience === 'fans') {
    const { data } = await getAdminClient()
      .from('fan_profiles')
      .select('id')
      .eq('email_unsubscribed', false)
    const fanIds = (data ?? []).map(r => r.id)
    if (fanIds.length === 0) return []
    const users = { users: await getAllUsers() }
    return (users?.users ?? [])
      .filter(u => fanIds.includes(u.id))
      .map(u => u.email!)
      .filter(Boolean)
  }

  if (audience === 'purchasers') {
    const { data } = await getAdminClient()
      .from('purchases')
      .select('buyer_user_id')
    const fanIds = [...new Set((data ?? []).map(r => r.buyer_user_id))].filter((id): id is string => !!id && !unsubscribed.has(id))
    if (fanIds.length === 0) return []
    const users = { users: await getAllUsers() }
    return (users?.users ?? [])
      .filter(u => fanIds.includes(u.id))
      .map(u => u.email!)
      .filter(Boolean)
  }

  // everyone
  const users = { users: await getAllUsers() }
  return (users?.users ?? [])
    .filter(u => !unsubscribed.has(u.id))
    .map(u => u.email!)
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { subject, body_markdown, audience } = await req.json()

  if (!subject || !body_markdown || !audience) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const html = buildBroadcastHtml(body_markdown)
  const emails = await getRecipientEmails(audience)

  const { data: broadcast, error: insertError } = await getAdminClient()
    .from('broadcast_history')
    .insert({
      subject,
      body_markdown,
      body_html: html,
      audience_filter: { audience },
      recipient_count: emails.length,
      sent_by: user.id,
      status: 'sending',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 })
  }

  let failCount = 0
  const BATCH_SIZE = 10
  const BATCH_DELAY = 200

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(email => sendEmail(email, subject, html))
    )
    failCount += results.filter(r => !r.ok).length

    if (i + BATCH_SIZE < emails.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }

  const finalStatus = failCount === emails.length ? 'failed' : 'sent'
  await getAdminClient()
    .from('broadcast_history')
    .update({ status: finalStatus, completed_at: new Date().toISOString() })
    .eq('id', broadcast.id)

  return NextResponse.json({
    ok: true,
    broadcast_id: broadcast.id,
    sent: emails.length - failCount,
    failed: failCount,
  })
}
