import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotificationBatch } from '@/lib/notifications'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 10, 1)
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { post_type, content, media_url } = body as {
    post_type: string
    content: string
    media_url?: string | null
  }

  const validTypes = ['text', 'photo', 'demo', 'voice_note']
  if (!validTypes.includes(post_type)) {
    return NextResponse.json({ error: 'Invalid post_type' }, { status: 400 })
  }
  if (!content?.trim() || content.length > 1000) {
    return NextResponse.json({ error: 'Content required (max 1000 chars)' }, { status: 400 })
  }
  if ((post_type === 'photo' || post_type === 'demo' || post_type === 'voice_note') && !media_url) {
    return NextResponse.json({ error: 'Media URL required for this post type' }, { status: 400 })
  }
  const supabaseStoragePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
  if (media_url && !media_url.startsWith(supabaseStoragePrefix)) {
    return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name, slug')
    .eq('id', user.id)
    .single()

  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  const { data: post, error: insertErr } = await supabase
    .from('artist_posts')
    .insert({
      artist_id: artist.id,
      post_type,
      content,
      media_url: media_url ?? null,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Fan-out notifications asynchronously — don't block the response
  const fanOut = async () => {
    try {
      const { data: followers } = await supabase
        .from('fan_follows')
        .select('user_id')
        .eq('artist_id', artist.id)

      if (followers && followers.length > 0) {
        const uniqueIds = [...new Set(followers.map(f => f.user_id))]
        const CHUNK = 50
        for (let i = 0; i < uniqueIds.length; i += CHUNK) {
          const chunk = uniqueIds.slice(i, i + CHUNK)
          await createNotificationBatch({
            supabase,
            userIds: chunk,
            type: 'artist_post',
            title: `${artist.name} posted an update`,
            body: content.slice(0, 100),
            link: `/${artist.slug}`,
          })
        }
      }
    } catch (err) {
      console.error('[posts] notification fan-out failed:', err)
    }
  }
  fanOut()

  return NextResponse.json({ post })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: posts, error } = await supabase
    .from('artist_posts')
    .select('id, post_type, content, media_url, created_at')
    .eq('artist_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts })
}
