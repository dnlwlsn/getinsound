import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, artist_id, delivered_at, merch ( name )')
    .eq('id', id)
    .eq('fan_id', user.id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Order must be delivered to request a return' }, { status: 409 })
  }

  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null
  if (!deliveredAt) {
    return NextResponse.json({ error: 'Delivered date not recorded' }, { status: 400 })
  }
  const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceDelivery > 14) {
    return NextResponse.json({ error: 'Return window has expired (14 days from delivery)' }, { status: 409 })
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'return_requested',
      return_requested_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: artist } = await supabase
    .from('artists')
    .select('return_address')
    .eq('id', order.artist_id)
    .maybeSingle()

  const merchName = (order.merch as unknown as { name: string } | null)?.name ?? 'an item'

  await supabase.from('notifications').insert({
    user_id: order.artist_id,
    type: 'merch_return',
    title: 'Return requested',
    body: `A fan has requested a return for ${merchName}.`,
    link: '/dashboard/orders',
  })

  return NextResponse.json({ ok: true, return_address: artist?.return_address ?? null })
}
