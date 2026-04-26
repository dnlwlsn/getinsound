import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
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
    .select('id, status, fan_id, stripe_payment_intent_id, amount_paid, merch ( name )')
    .eq('id', id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'return_requested') {
    return NextResponse.json({ error: 'Order must be in return_requested status' }, { status: 409 })
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No payment intent on order' }, { status: 400 })
  }

  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'returned',
      returned_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  await admin.from('platform_costs').insert({
    related_order_id: id,
    cost_type: 'merch_return_stripe_fee',
    amount: refund.amount,
    currency: refund.currency,
    notes: `Stripe refund ${refund.id}`,
  })

  const merchName = (order.merch as unknown as { name: string } | null)?.name ?? 'your order'

  await supabase.from('notifications').insert({
    user_id: order.fan_id,
    type: 'merch_return',
    title: 'Return confirmed — refund issued',
    body: `Your return for ${merchName} has been confirmed. A refund has been issued to your original payment method.`,
    link: '/orders',
  })

  return NextResponse.json({ ok: true, refund_id: refund.id })
}
