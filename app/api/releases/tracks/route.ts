import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const releaseId = req.nextUrl.searchParams.get('releaseId')
  if (!releaseId) {
    return NextResponse.json({ error: 'releaseId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tracks')
    .select('id, title, position, duration_sec')
    .eq('release_id', releaseId)
    .order('position', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
