import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { artist_id, week_of, editorial_note } = await req.json().catch(() => ({} as any))
  if (!artist_id || !week_of) {
    return NextResponse.json({ error: 'artist_id and week_of required' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabaseAdmin
    .from('featured_artists')
    .upsert(
      { artist_id, week_of, editorial_note: editorial_note || null },
      { onConflict: 'week_of' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
