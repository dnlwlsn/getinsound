import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


const GRANT_EXPIRY_HOURS = 48
const GRANT_MAX_USES = 10

/** GET — generate download grants for all of a user's purchases */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: purchases, error: purchaseErr } = await supabase
    .from('purchases')
    .select(`
      id,
      releases (
        id, title, cover_url,
        artists!inner ( name ),
        tracks ( id, title, position, audio_path )
      )
    `)
    .eq('buyer_user_id', user.id)
    .eq('status', 'paid')

  if (purchaseErr) return NextResponse.json({ error: purchaseErr.message }, { status: 500 })
  if (!purchases || purchases.length === 0) return NextResponse.json({ releases: [] })

  const expiresAt = new Date(Date.now() + GRANT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  const results = []
  for (const purchase of purchases) {
    const release = purchase.releases as any
    if (!release) continue

    const { data: existing } = await supabase
      .from('download_grants')
      .select('token, expires_at')
      .eq('purchase_id', purchase.id)
      .maybeSingle()

    let grant: { token: string } | null = null
    let grantErr: any = null

    if (existing && new Date(existing.expires_at) > new Date()) {
      grant = { token: existing.token }
    } else if (existing) {
      const res = await supabase
        .from('download_grants')
        .update({ token: crypto.randomUUID(), expires_at: expiresAt, used_count: 0, max_uses: GRANT_MAX_USES })
        .eq('purchase_id', purchase.id)
        .select('token')
        .single()
      grant = res.data
      grantErr = res.error
    } else {
      const res = await supabase
        .from('download_grants')
        .insert({ purchase_id: purchase.id, token: crypto.randomUUID(), expires_at: expiresAt, used_count: 0, max_uses: GRANT_MAX_USES })
        .select('token')
        .single()
      grant = res.data
      grantErr = res.error
    }

    if (grantErr || !grant) {
      console.error('Grant creation failed for purchase', purchase.id, grantErr?.message)
      continue
    }

    const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists
    const tracks = [...(release.tracks ?? [])].sort((a: any, b: any) => a.position - b.position)

    results.push({
      releaseTitle: release.title,
      artistName: artist?.name ?? '',
      coverUrl: release.cover_url,
      downloadToken: grant.token,
      trackCount: tracks.length,
    })
  }

  return NextResponse.json({ releases: results, expiresAt })
}
