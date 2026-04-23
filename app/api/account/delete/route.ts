import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFreshAuth } from '@/lib/fresh-auth'

export const runtime = 'edge'

/** GET — returns pending deletion request + impact data (for artists) */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pending } = await supabase
    .from('account_deletion_requests')
    .select('id, execute_at, requested_at')
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)
    .maybeSingle()

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  let impact = null
  if (artist) {
    const [releasesRes, salesRes, preordersRes] = await Promise.all([
      supabase.from('releases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id),
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id).eq('status', 'paid'),
      supabase
        .from('purchases')
        .select('id, releases!inner(preorder_enabled, cancelled)', { count: 'exact', head: true })
        .eq('artist_id', user.id)
        .eq('status', 'paid')
        .eq('pre_order', true)
        .eq('releases.preorder_enabled', true)
        .eq('releases.cancelled', false),
    ])
    impact = {
      releaseCount: releasesRes.count ?? 0,
      totalSales: salesRes.count ?? 0,
      activePreorders: preordersRes.count ?? 0,
    }
  }

  return NextResponse.json({
    pending: pending ?? null,
    isArtist: !!artist,
    impact,
  })
}

/** POST — create a deletion request */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const freshAuthError = await requireFreshAuth(request)
  if (freshAuthError) return freshAuthError

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const userType = artist ? 'artist' : 'fan'

  const { data: request, error: insertErr } = await supabase
    .from('account_deletion_requests')
    .insert({ user_id: user.id, user_type: userType })
    .select('id, execute_at')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'A deletion request is already pending.' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Send confirmation email via Resend
  const cancelUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'}/settings/account?cancel-deletion=true`
  const executeDate = new Date(request.execute_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [user.email],
        subject: 'Account deletion scheduled',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your account is scheduled for deletion.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:8px;">
          Your Insound account and all associated data will be permanently deleted on <strong style="color:#FAFAFA">${executeDate}</strong>.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          We recommend downloading your purchased music before then. If you change your mind, you can cancel at any time before the deadline.
        </td></tr>
        <tr><td>
          <a href="${cancelUrl}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Cancel deletion &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    })
  } catch (e) {
    console.error('Deletion confirmation email failed:', (e as Error).message)
  }

  return NextResponse.json({ id: request.id, execute_at: request.execute_at })
}

/** DELETE — cancel a pending deletion request */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error: updateErr } = await supabase
    .from('account_deletion_requests')
    .update({ cancelled: true })
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
