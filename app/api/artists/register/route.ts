import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rateLimited = await checkRateLimit(ip, 'artist_register', 3, 1)
  if (rateLimited) return rateLimited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { slug, name, bio, accent_colour, email } = body as {
    slug: string
    name: string
    bio?: string
    accent_colour?: string
    email: string
  }

  if (!slug || !name || !email) {
    return NextResponse.json({ error: 'slug, name, and email are required' }, { status: 400 })
  }

  if (name.trim().length > 200) {
    return NextResponse.json({ error: 'Name must be 200 characters or fewer' }, { status: 400 })
  }

  if (bio && bio.trim().length > 2000) {
    return NextResponse.json({ error: 'Bio must be 2000 characters or fewer' }, { status: 400 })
  }

  if (accent_colour && !/^#[0-9A-Fa-f]{6}$/.test(accent_colour)) {
    return NextResponse.json({ error: 'Invalid accent colour format' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const trimmedSlug = slug.trim().toLowerCase()

  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedSlug)) {
    return NextResponse.json({ error: 'URL must be 3-40 characters: lowercase letters, numbers, hyphens.' }, { status: 400 })
  }

  if (RESERVED_SLUGS.has(trimmedSlug)) {
    return NextResponse.json({ error: `"${trimmedSlug}" is reserved. Try another.` }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .eq('slug', trimmedSlug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `"${trimmedSlug}" is already taken. Try another.` }, { status: 409 })
  }

  const { error: artistErr } = await supabase
    .from('artists')
    .insert({
      id: user.id,
      slug: trimmedSlug,
      name: name.trim(),
      bio: bio?.trim() || null,
      accent_colour: accent_colour || '#F56D00',
    })

  if (artistErr) {
    if (artistErr.code === '23505') {
      return NextResponse.json({ error: `"${trimmedSlug}" is already taken. Try another.` }, { status: 409 })
    }
    return NextResponse.json({ error: artistErr.message }, { status: 500 })
  }

  const { error: accountErr } = await supabase
    .from('artist_accounts')
    .insert({
      id: user.id,
      email,
      self_attest_independent: true,
      independence_confirmed: true,
      independence_confirmed_at: new Date().toISOString(),
    })

  if (accountErr) {
    await supabase.from('artists').delete().eq('id', user.id)
    return NextResponse.json({ error: accountErr.message }, { status: 500 })
  }

  await supabase
    .from('fan_profiles')
    .update({ has_seen_welcome: true })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
