import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_feedback')
    .select('*, fan_profiles:user_id(username, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }

  return NextResponse.json({ feedback: data })
}
