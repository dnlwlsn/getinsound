import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
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
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { return_address } = await req.json()
  if (!return_address?.line1 || !return_address?.city || !return_address?.postcode || !return_address?.country) {
    return NextResponse.json({ error: 'Address must include line1, city, postcode, and country' }, { status: 400 })
  }

  if (return_address.line1.length > 200 || (return_address.line2 && return_address.line2.length > 200)) {
    return NextResponse.json({ error: 'Address lines must be 200 characters or fewer' }, { status: 400 })
  }
  if (return_address.city.length > 100) {
    return NextResponse.json({ error: 'City must be 100 characters or fewer' }, { status: 400 })
  }
  if (return_address.postcode.length > 20) {
    return NextResponse.json({ error: 'Postcode must be 20 characters or fewer' }, { status: 400 })
  }
  if (return_address.country.length > 3) {
    return NextResponse.json({ error: 'Country must be 3 characters or fewer' }, { status: 400 })
  }

  const { error } = await supabase
    .from('artists')
    .update({ return_address })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
