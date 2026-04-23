import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export const runtime = 'edge'
export async function GET() {
  const { supabase } = await requireAdmin()

  const { data: flags, error } = await supabase
    .from('suspicious_activity_flags')
    .select(`
      id, flag_type, details, reviewed, reviewed_by, reviewed_at, created_at,
      user_id,
      artists!inner(name, slug)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ flags: flags || [] })
}
