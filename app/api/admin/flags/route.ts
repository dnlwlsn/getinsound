import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let { data: flags, error } = await supabase
    .from('suspicious_activity_flags')
    .select(`
      id, flag_type, details, reviewed, reviewed_by, reviewed_at, created_at,
      user_id,
      artists!inner(name, slug)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Flags fetch error (with join):', error)
    const fallback = await supabase
      .from('suspicious_activity_flags')
      .select('*')
      .order('created_at', { ascending: false })
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    }
    flags = (fallback.data || []).map((d: any) => ({ ...d, artists: null }))
  }

  return NextResponse.json({ flags: flags || [] })
}

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { artist_name, flag_type, notes } = await req.json().catch(() => ({} as any))
  if (!artist_name || !flag_type) {
    return NextResponse.json({ error: 'artist_name and flag_type required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const slug = artist_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const { data: bySlug } = await supabase
    .from('artists')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()

  const artist = bySlug ?? (await supabase
    .from('artists')
    .select('id, name')
    .ilike('name', `%${artist_name.replace(/[^a-zA-Z0-9 -]/g, '')}%`)
    .maybeSingle()).data

  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  const { error } = await supabase
    .from('suspicious_activity_flags')
    .insert({
      user_id: artist.id,
      flag_type,
      details: { notes: notes || 'Manually raised by admin', raised_by: user.id },
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, artist_name: artist.name })
}
