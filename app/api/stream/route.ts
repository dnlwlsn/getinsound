import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour

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

  // Fetch the track with its release info
  const { data: track, error: trackErr } = await supabase
    .from('tracks')
    .select('id, release_id, audio_path, preview_path')
    .eq('id', trackId)
    .single()

  if (trackErr || !track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  // Check if the user owns this release or has purchased it
  const { data: { user } } = await supabase.auth.getUser()
  let hasFullAccess = false

  if (user) {
    // Artist owns their own tracks
    const { data: release } = await supabase
      .from('releases')
      .select('artist_id')
      .eq('id', track.release_id)
      .single()

    if (release?.artist_id === user.id) {
      hasFullAccess = true
    } else {
      const { count } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_user_id', user.id)
        .eq('release_id', track.release_id)
        .eq('status', 'paid')
        .eq('pre_order', false)

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
    })
  }

  // Preview — public bucket, stable URL so Cloudflare can cache at edge
  if (track.preview_path) {
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
    const admin = getAdminClient()
    const { data: signed, error: signErr } = await admin.storage
      .from('masters')
      .createSignedUrl(track.audio_path, SIGNED_URL_EXPIRY)

    if (!signErr && signed) {
      const fmt = track.audio_path!.split('.').pop()?.toLowerCase() || 'wav'
      return NextResponse.json({
        url: signed.signedUrl,
        isPreview: false,
        format: fmt,
      })
    }
  }

  return NextResponse.json({ error: 'No audio available' }, { status: 404 })
}
