import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!artist) return NextResponse.json({ error: 'Not an artist' }, { status: 403 })

  const body = await req.json()
  const { tracking_number, carrier } = body
  if (!tracking_number || !carrier) {
    return NextResponse.json({ error: 'tracking_number and carrier are required' }, { status: 400 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, fan_id, merch ( name )')
    .eq('id', id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Order must be pending to dispatch' }, { status: 409 })
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'dispatched',
      tracking_number,
      carrier,
      dispatched_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const merchName = (order.merch as unknown as { name: string } | null)?.name ?? 'your order'

  await supabase.from('notifications').insert({
    user_id: order.fan_id,
    type: 'merch_dispatched',
    title: 'Your order has been dispatched',
    body: `${merchName} is on its way. Tracking: ${tracking_number} (${carrier})`,
    link: '/orders',
  })

  return NextResponse.json({ ok: true })
}
