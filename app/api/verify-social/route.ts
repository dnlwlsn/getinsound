import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialLinks } from '@/lib/verification'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'
import dns from 'dns/promises'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'social_verify', 10, 1)
  if (limited) return limited

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

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 })
  }
  const hostname = parsedUrl.hostname

  function isPrivateIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true
    const parts = ip.split('.').map(Number)
    if (parts.length === 4) {
      if (parts[0] === 10) return true
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      if (parts[0] === 192 && parts[1] === 168) return true
      if (parts[0] === 169 && parts[1] === 254) return true
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true
      if (parts[0] === 0) return true
    }
    if (ip.startsWith('fe80:') || ip.startsWith('fd') || ip.startsWith('fc')) return true
    if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7))
    return false
  }

  if (
    hostname === 'localhost' ||
    hostname.includes('internal') ||
    hostname.endsWith('.local') ||
    isPrivateIp(hostname)
  ) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let resolvedAddresses: string[]
  try {
    const records = await dns.resolve4(hostname).catch(() => [] as string[])
    const records6 = await dns.resolve6(hostname).catch(() => [] as string[])
    resolvedAddresses = [...records, ...records6]
  } catch {
    return NextResponse.json({ error: 'Could not resolve hostname' }, { status: 400 })
  }

  if (resolvedAddresses.length === 0) {
    return NextResponse.json({ error: 'Could not resolve hostname' }, { status: 400 })
  }

  if (resolvedAddresses.some(isPrivateIp)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let exists = false
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) })
    exists = res.ok || res.status === 405 || res.status === 403 || (res.status >= 300 && res.status < 400)
  } catch {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) })
      exists = res.ok || (res.status >= 300 && res.status < 400)
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
