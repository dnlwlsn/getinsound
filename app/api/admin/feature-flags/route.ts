import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'
import { invalidateCache } from '@/lib/feature-flags'

export const runtime = 'edge'
function getAdminClient() { return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) }

export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await getAdminClient()
    .from('site_settings')
    .select('*')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, value } = await req.json()
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 })
  }

  const { error } = await getAdminClient()
    .from('site_settings')
    .update({ value: String(value), updated_at: new Date().toISOString(), updated_by: user.email })
    .eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateCache(key)
  return NextResponse.json({ ok: true })
}
