import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const rateLimited = await checkRateLimit(ipHash, 'redeem_code', 10, 1)
  if (rateLimited) return rateLimited

  const body = await req.json()
  const code = (body.code as string)?.trim()?.toUpperCase()
  const email = (body.email as string)?.trim()?.toLowerCase()
  const action = body.action as string

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  if (action === 'validate') {
    const { data, error } = await admin
      .from('download_codes')
      .select('id, release_id, redeemed_by, expires_at, releases(title, cover_url, type, artists(name, slug))')
      .eq('code', code)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
    }

    if (data.redeemed_by) {
      return NextResponse.json({ error: 'This code has already been redeemed' }, { status: 410 })
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This code has expired' }, { status: 410 })
    }

    const release = data.releases as unknown as Record<string, unknown> | null
    const artist = (release?.artists as unknown as Record<string, unknown>) ?? null

    return NextResponse.json({
      release: {
        title: release?.title,
        cover_url: release?.cover_url,
        type: release?.type,
        artist_name: artist?.name,
        artist_slug: artist?.slug,
      },
    })
  }

  if (action === 'redeem') {
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRateLimited = await checkRateLimit(email, 'redeem_code', 10, 1)
    if (emailRateLimited) return emailRateLimited

    // Progressive account creation: try to create, fall back to existing
    let userId: string
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (newUser?.user) {
      userId = newUser.user.id
    } else if (createErr?.message?.includes('already been registered')) {
      // User exists — generateLink returns the user object without side effects
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })
      if (!linkData?.user?.id) {
        return NextResponse.json({ error: 'Failed to find account' }, { status: 500 })
      }
      userId = linkData.user.id
    } else {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    // Check if this user already redeemed a code for this release
    const { data: codeInfo } = await admin
      .from('download_codes')
      .select('release_id')
      .eq('code', code)
      .maybeSingle()

    if (codeInfo) {
      const { data: existingPurchase } = await admin
        .from('purchases')
        .select('id')
        .eq('buyer_user_id', userId)
        .eq('release_id', codeInfo.release_id)
        .eq('status', 'paid')
        .maybeSingle()

      if (existingPurchase) {
        return NextResponse.json({
          error: 'You already own this release',
        }, { status: 409 })
      }
    }

    // Atomic redemption via RPC
    const { data: redeemed, error: redeemErr } = await admin.rpc('redeem_download_code', {
      p_code: code,
      p_user_id: userId,
      p_email: email,
    })

    if (redeemErr || !redeemed || (redeemed as unknown[]).length === 0) {
      return NextResponse.json({
        error: 'This code is no longer available',
      }, { status: 410 })
    }

    const result = (redeemed as { artist_id: string; release_id: string }[])[0]

    // Notify the artist
    await createNotification({
      supabase: admin,
      userId: result.artist_id,
      type: 'code_redeemed',
      title: 'Download code redeemed',
      body: `A fan redeemed a download code for your release.`,
      link: '/dashboard/codes',
    })

    // Send magic link so the user can access their library
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/callback?next=/library`,
      },
    })

    if (linkData?.properties?.hashed_token) {
      const { buildMagicLinkEmail } = await import('@/lib/email/templates')
      const { sendEmail } = await import('@/lib/email/send')
      const tokenHash = linkData.properties.hashed_token
      const magicLink = `${SITE_URL}/auth/callback?next=/library&token_hash=${tokenHash}&type=magiclink`
      const { subject, html } = buildMagicLinkEmail(magicLink, 'redeem')
      await sendEmail(email, subject, html)
    }

    return NextResponse.json({ redeemed: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
