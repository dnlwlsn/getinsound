import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('user_feedback')
    .select('*, fan_profiles:user_id(username, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }

  return NextResponse.json({ feedback: data })
}
