import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour

/** GET /api/stream?trackId=xxx — returns a signed URL for audio playback */
export async function GET(request: Request) {
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

    return NextResponse.json({
      url: signed.signedUrl,
      isPreview: false,
    })
  }

  // Preview — public 'previews' bucket (still use signed URL for consistency)
  if (track.preview_path) {
    const { data: signed, error: signErr } = await supabase.storage
      .from('previews')
      .createSignedUrl(track.preview_path, SIGNED_URL_EXPIRY)

    if (signErr || !signed) {
      // Fallback to public URL
      const { data: publicUrl } = supabase.storage
        .from('previews')
        .getPublicUrl(track.preview_path)

      return NextResponse.json({
        url: publicUrl.publicUrl,
        isPreview: true,
      })
    }

    return NextResponse.json({
      url: signed.signedUrl,
      isPreview: true,
    })
  }

  return NextResponse.json({ error: 'No audio available' }, { status: 404 })
}
