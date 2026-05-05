import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'
import { buildMagicLinkEmail } from '@/lib/email/templates'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'redownload', 2, 10)
  if (limited) return limited

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 })
  }

  const { purchase_id } = await request.json()

  if (!purchase_id) {
    return NextResponse.json({ error: 'Missing purchase_id' }, { status: 400 })
  }

  // Verify user owns this purchase
  const { data: purchase, error: purchaseError } = await getAdminClient()
    .from('purchases')
    .select('id, buyer_user_id, release_id, releases ( title, slug, artists ( name, slug ) )')
    .eq('id', purchase_id)
    .eq('status', 'paid')
    .or('pre_order.eq.false,pre_order.is.null')
    .single()

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  }

  if (purchase.buyer_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return existing active grant if one exists
  const { data: existingGrant } = await getAdminClient()
    .from('download_grants')
    .select('token')
    .eq('purchase_id', purchase_id)
    .gt('expires_at', new Date().toISOString())
    .lt('used_count', 5)
    .maybeSingle()

  if (existingGrant) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'
    const release = purchase.releases as any
    const artist = Array.isArray(release?.artists) ? release.artists[0] : release?.artists
    const downloadLink = `${siteUrl}/download/${existingGrant.token}`
    const { subject, html } = buildMagicLinkEmail(
      downloadLink,
      'purchase',
      { releaseTitle: release?.title, artistName: artist?.name, userId: user.id },
    )
    await sendEmail(user.email!, subject, html)
    return NextResponse.json({ ok: true })
  }

  // Create a new download grant (7 days, 5 uses)
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: grantError } = await getAdminClient()
    .from('download_grants')
    .insert({
      purchase_id,
      token,
      expires_at: expiresAt,
      max_uses: 5,
    })

  if (grantError) {
    return NextResponse.json({ error: 'Failed to create download grant' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'
  const release = purchase.releases as any
  const artist = Array.isArray(release?.artists) ? release.artists[0] : release?.artists
  const downloadLink = `${siteUrl}/download/${token}`

  const { subject, html } = buildMagicLinkEmail(
    downloadLink,
    'purchase',
    {
      releaseTitle: release?.title,
      artistName: artist?.name,
      userId: user.id,
    },
  )

  await sendEmail(user.email!, subject, html)

  return NextResponse.json({ ok: true })
}
