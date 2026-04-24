import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'


export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: artist } = await admin
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!artist) return NextResponse.json({ error: 'Not an artist' }, { status: 400 })

  const { data: already } = await admin
    .from('fan_badges')
    .select('id')
    .eq('user_id', user.id)
    .eq('badge_type', 'founding_artist')
    .maybeSingle()

  if (already) return NextResponse.json({ ok: true, already: true })

  const { data: waitlistEntry } = await admin
    .from('waitlist')
    .select('id, email, created_at')
    .eq('email', user.email!)
    .maybeSingle()

  if (!waitlistEntry) return NextResponse.json({ ok: true, eligible: false })

  const { count } = await admin
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .lte('created_at', waitlistEntry.created_at)

  if (!count || count > 50) return NextResponse.json({ ok: true, eligible: false })

  await admin
    .from('fan_badges')
    .insert({
      user_id: user.id,
      badge_type: 'founding_artist',
      metadata: { position: count },
    })

  return NextResponse.json({ ok: true, awarded: true, position: count })
}
