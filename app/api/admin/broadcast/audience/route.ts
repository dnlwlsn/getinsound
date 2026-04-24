import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

function getAdminClient() { return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) }

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { audience } = await req.json()

  let query = getAdminClient().from('artist_accounts').select('email', { count: 'exact', head: true })

  if (audience === 'artists') {
    // all artists — already querying artist_accounts
  } else if (audience === 'fans') {
    const { count } = await getAdminClient()
      .from('fan_profiles')
      .select('id', { count: 'exact', head: true })
    return NextResponse.json({ count: count ?? 0 })
  } else if (audience === 'purchasers') {
    const { count } = await getAdminClient()
      .from('purchases')
      .select('fan_id', { count: 'exact', head: true })
    return NextResponse.json({ count: count ?? 0 })
  } else {
    // 'everyone' — artists + fans
    const [{ count: artistCount }, { count: fanCount }] = await Promise.all([
      getAdminClient().from('artist_accounts').select('email', { count: 'exact', head: true }),
      getAdminClient().from('fan_profiles').select('id', { count: 'exact', head: true }),
    ])
    return NextResponse.json({ count: (artistCount ?? 0) + (fanCount ?? 0) })
  }

  const { count } = await query
  return NextResponse.json({ count: count ?? 0 })
}
