import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artist } = await supabase
    .from('artists')
    .select('return_address')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({ return_address: artist?.return_address || null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { return_address } = await req.json()
  if (!return_address?.line1 || !return_address?.city || !return_address?.postcode || !return_address?.country) {
    return NextResponse.json({ error: 'Address must include line1, city, postcode, and country' }, { status: 400 })
  }

  const { error } = await supabase
    .from('artists')
    .update({ return_address })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
