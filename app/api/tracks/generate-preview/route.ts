import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** POST /api/tracks/generate-preview — trigger preview generation for a track */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const trackId: string | undefined = body.track_id

    if (!trackId) {
      return NextResponse.json({ error: 'track_id required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify the user is authenticated
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the track and its release to verify ownership
    const { data: track, error: trackErr } = await supabase
      .from('tracks')
      .select('id, release_id, audio_path, preview_path')
      .eq('id', trackId)
      .single()

    if (trackErr || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    if (track.preview_path) {
      return NextResponse.json({ ok: true, preview_path: track.preview_path })
    }

    if (!track.audio_path) {
      return NextResponse.json({ error: 'Track has no audio file' }, { status: 400 })
    }

    // Verify the user owns this track (via release -> artist_id)
    const { data: release, error: releaseErr } = await supabase
      .from('releases')
      .select('artist_id')
      .eq('id', track.release_id)
      .single()

    if (releaseErr || !release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.artist_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Call the Supabase Edge Function to generate the preview
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const fnUrl = `${supabaseUrl}/functions/v1/generate-preview`
    const fnResp = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ track_id: trackId }),
    })

    const fnData = await fnResp.json()

    if (!fnResp.ok) {
      return NextResponse.json(
        { error: fnData.error || 'Preview generation failed' },
        { status: fnResp.status },
      )
    }

    return NextResponse.json(fnData)
  } catch (err) {
    console.error('generate-preview error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
