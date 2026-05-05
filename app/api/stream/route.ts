import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

const SIGNED_URL_EXPIRY = 5 * 60 // 5 minutes

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** GET /api/stream?trackId=xxx — returns a signed URL for audio playback */
export async function GET(request: Request) {
  const ip = getClientIp(request.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 120, 1)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get('trackId')

  if (!trackId) {
    return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = getAdminClient()

  // Fetch track with admin client — anon RLS may block logged-out reads
  const { data: track, error: trackErr } = await admin
    .from('tracks')
    .select('id, release_id, audio_path, preview_path')
    .eq('id', trackId)
    .single()

  if (trackErr || !track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  // Check if the user owns this release or has purchased it
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  let hasFullAccess = false

  if (user) {
    // Artist owns their own tracks
    const { data: release } = await supabase
      .from('releases')
      .select('artist_id, published')
      .eq('id', track.release_id)
      .single()

    if (release?.artist_id === user.id) {
      hasFullAccess = true
    } else if (!release?.published) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    } else {
      const { count } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_user_id', user.id)
        .eq('release_id', track.release_id)
        .eq('status', 'paid')
        .or('pre_order.eq.false,pre_order.is.null')

      hasFullAccess = (count ?? 0) > 0
    }
  }

  if (hasFullAccess && track.audio_path) {
    // Full track — signed URL from private 'masters' bucket
    const { data: signed, error: signErr } = await supabase.storage
      .from('masters')
      .createSignedUrl(track.audio_path, SIGNED_URL_EXPIRY)

    if (signErr || !signed) {
      return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
    }

    const format = track.audio_path.split('.').pop()?.toLowerCase() || 'wav'
    return NextResponse.json({
      url: signed.signedUrl,
      isPreview: false,
      format,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Non-owner accessing unpublished release — block even preview
  if (!hasFullAccess) {
    const { data: rel } = await admin
      .from('releases')
      .select('published')
      .eq('id', track.release_id)
      .single()
    if (!rel?.published) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }
  }

  // Preview — public bucket, stable URL so Cloudflare can cache at edge
  if (track.preview_path) {
    // Per-IP-per-track rate limit to prevent systematic preview downloading
    const previewLimited = await checkRateLimit(`${ipHash}:stream:${trackId}`, 'general', 10, 1)
    if (previewLimited) return previewLimited

    const { data: publicUrl } = supabase.storage
      .from('previews')
      .getPublicUrl(track.preview_path)

    return NextResponse.json({
      url: publicUrl.publicUrl,
      isPreview: true,
      previewDuration: 30,
    })
  }

  // No preview clip available — refuse to serve the full master to non-purchasers
  if (!hasFullAccess) {
    return NextResponse.json({ error: 'No preview available' }, { status: 404 })
  }

  // Full-access user but preview_path is missing — serve from masters
  if (track.audio_path) {
    const { data: signed, error: signErr } = await admin.storage
      .from('masters')
      .createSignedUrl(track.audio_path, SIGNED_URL_EXPIRY)

    if (!signErr && signed) {
      const fmt = track.audio_path!.split('.').pop()?.toLowerCase() || 'wav'
      return NextResponse.json({
        url: signed.signedUrl,
        isPreview: false,
        format: fmt,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return NextResponse.json({ error: 'No audio available' }, { status: 404 })
}
