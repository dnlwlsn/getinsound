import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialLinks } from '@/lib/verification'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!artist) return NextResponse.json({ error: 'Not an artist' }, { status: 403 })

  const { platform, url } = await req.json() as { platform: SocialPlatform; url: string }

  const config = SOCIAL_PLATFORMS.find(p => p.key === platform)
  if (!config) return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })

  if (!url || !config.pattern.test(url)) {
    return NextResponse.json({ error: 'Invalid URL for this platform' }, { status: 400 })
  }

  let exists = false
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    exists = res.ok || res.status === 405 || res.status === 403
  } catch {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000) })
      exists = res.ok
    } catch {
      exists = false
    }
  }

  const { data: current } = await supabase
    .from('artists')
    .select('social_links')
    .eq('id', user.id)
    .single()

  const links: SocialLinks = (current?.social_links as SocialLinks) || {}
  links[platform] = {
    url,
    verified: exists,
    verified_at: exists ? new Date().toISOString() : null,
  }

  const { error } = await supabase
    .from('artists')
    .update({ social_links: links })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ platform, url, verified: exists })
}
