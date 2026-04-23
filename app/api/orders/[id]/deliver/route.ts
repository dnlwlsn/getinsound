import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

export const runtime = 'edge'
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

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, fan_id, merch ( name )')
    .eq('id', id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'dispatched') {
    return NextResponse.json({ error: 'Order must be dispatched to mark as delivered' }, { status: 409 })
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const merchName = (order.merch as unknown as { name: string } | null)?.name ?? 'your order'

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  await createNotification({
    supabase: admin,
    userId: order.fan_id,
    type: 'merch_delivered',
    title: 'Your order has been delivered',
    body: `${merchName} has been marked as delivered. If you have any issues, you can request a return within 14 days.`,
    link: '/orders',
  })

  return NextResponse.json({ ok: true })
}
