import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = [
  'dmca_copyright',
  'ai_generated_music',
  'impersonation',
  'harassment_hate_speech',
  'spam_scam',
  'inappropriate_content',
  'underage_user',
  'stolen_artwork',
  'misleading_info',
  'other',
] as const

const MAX_REPORTS_PER_DAY = 5

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { profileType, artistId, fanId, category, details } = body

  if (!profileType || !category) {
    return NextResponse.json({ error: 'profileType and category are required' }, { status: 400 })
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (profileType === 'artist' && !artistId) {
    return NextResponse.json({ error: 'artistId is required for artist reports' }, { status: 400 })
  }

  if (profileType === 'fan' && !fanId) {
    return NextResponse.json({ error: 'fanId is required for fan reports' }, { status: 400 })
  }

  if (profileType === 'fan' && fanId === user.id) {
    return NextResponse.json({ error: 'You cannot report your own profile' }, { status: 400 })
  }

  const since = new Date()
  since.setHours(since.getHours() - 24)
  const { count } = await supabase
    .from('profile_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_id', user.id)
    .gte('created_at', since.toISOString())

  if ((count ?? 0) >= MAX_REPORTS_PER_DAY) {
    return NextResponse.json({ error: 'You have reached the daily report limit. Please try again later.' }, { status: 429 })
  }

  const { error } = await supabase
    .from('profile_reports')
    .insert({
      reporter_id: user.id,
      reported_profile_type: profileType,
      reported_artist_id: profileType === 'artist' ? artistId : null,
      reported_fan_id: profileType === 'fan' ? fanId : null,
      category,
      details: details?.trim() || null,
    })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already reported this profile for this reason' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
