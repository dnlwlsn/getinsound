import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artist } = await supabase
    .from('artists')
    .select('id, return_address')
    .eq('id', user.id)
    .maybeSingle()
  if (!artist) return NextResponse.json({ error: 'Not an artist' }, { status: 403 })

  if (!artist.return_address) {
    return NextResponse.json({ error: 'Return address required before listing merch' }, { status: 400 })
  }

  const body = await req.json()
  const { name, description, price, currency, postage, stock, variants, dispatch_estimate } = body

  if (!name || !description || !price || !currency || postage == null || stock == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof price !== 'number' || price < 200 || price > 10000000) {
    return NextResponse.json({ error: 'Price must be between 200 and 10000000 (smallest currency unit)' }, { status: 400 })
  }
  if (typeof postage !== 'number' || postage < 0 || postage > 10000000) {
    return NextResponse.json({ error: 'Postage must be between 0 and 10000000' }, { status: 400 })
  }
  if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
    return NextResponse.json({ error: 'Stock must be a non-negative integer' }, { status: 400 })
  }

  const { data: merch, error } = await supabase
    .from('merch')
    .insert({
      artist_id: user.id,
      name,
      description,
      price,
      currency,
      postage,
      stock,
      variants: variants || null,
      dispatch_estimate: dispatch_estimate || 'Ships within 5 days',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(merch, { status: 201 })
}
