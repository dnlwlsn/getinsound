import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name', 'description', 'price', 'currency', 'postage', 'stock', 'variants', 'dispatch_estimate', 'is_active', 'photos']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if ('name' in updates && (typeof updates.name !== 'string' || updates.name.length > 200)) {
    return NextResponse.json({ error: 'Name must be a string (max 200 chars)' }, { status: 400 })
  }
  if ('description' in updates && (typeof updates.description !== 'string' || updates.description.length > 5000)) {
    return NextResponse.json({ error: 'Description must be a string (max 5000 chars)' }, { status: 400 })
  }

  if ('price' in updates && (typeof updates.price !== 'number' || updates.price < 300 || updates.price > 10_000_000)) {
    return NextResponse.json({ error: 'Price must be between 300 and 10,000,000 (in pence/cents)' }, { status: 400 })
  }
  if ('postage' in updates && (typeof updates.postage !== 'number' || updates.postage < 0 || updates.postage > 10_000_000)) {
    return NextResponse.json({ error: 'Postage must be between 0 and 10,000,000' }, { status: 400 })
  }
  if ('stock' in updates && (typeof updates.stock !== 'number' || updates.stock < 0)) {
    return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 })
  }

  const { error } = await supabase
    .from('merch')
    .update(updates)
    .eq('id', id)
    .eq('artist_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('merch')
    .update({ is_active: false })
    .eq('id', id)
    .eq('artist_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
