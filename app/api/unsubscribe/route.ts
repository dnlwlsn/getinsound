import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const { user_id, unsubscribe } = await req.json()

  if (!user_id || typeof unsubscribe !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await getAdminClient()
    .from('fan_profiles')
    .update({ email_unsubscribed: unsubscribe })
    .eq('id', user_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
