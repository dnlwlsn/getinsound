import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, artist_id, fan_id, stripe_payment_intent_id, tracking_number, carrier, dispatched_at, merch ( name )')
    .eq('id', id)
    .eq('fan_id', user.id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const merchName = (order.merch as unknown as { name: string } | null)?.name ?? 'your order'
  const now = Date.now()
  const dispatchedAt = order.dispatched_at ? new Date(order.dispatched_at).getTime() : null
  const daysSinceDispatch = dispatchedAt ? (now - dispatchedAt) / (1000 * 60 * 60 * 24) : null

  // Branch 1: No tracking number
  if (!order.tracking_number) {
    // Less than 14 days — still within expected window
    if (daysSinceDispatch === null || daysSinceDispatch < 14) {
      return NextResponse.json({
        result: 'pending',
        message: 'Your order is still within the expected delivery window. Please allow more time for delivery.',
      })
    }

    // 14+ days with no tracking — full refund from artist
    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent on order' }, { status: 400 })
    }

    let refund: Stripe.Refund
    try {
      refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id })
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }

    await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', id)

    await supabase.from('notifications').insert({
      user_id: order.artist_id,
      type: 'merch_dispute',
      title: 'Order dispute — refund issued',
      body: `A fan reported a problem with ${merchName} (no tracking after 14 days). A full refund has been issued.`,
      link: '/dashboard/orders',
    })

    return NextResponse.json({ result: 'refunded', refund_id: refund.id })
  }

  // Branch 2: Has tracking number but no TrackingMore API key
  const trackingApiKey = process.env.TRACKINGMORE_API_KEY
  if (!trackingApiKey) {
    const { data: artist } = await supabase
      .from('artists')
      .select('social_links')
      .eq('id', order.artist_id)
      .maybeSingle()

    return NextResponse.json({
      result: 'manual_check',
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      social_links: artist?.social_links ?? null,
      message: 'Please use your tracking number to check the status with the carrier, or contact the artist directly.',
    })
  }

  // Branch 3: Has tracking + TrackingMore API key — look up live status
  let trackingData: Record<string, unknown> | null = null
  try {
    const res = await fetch(
      `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${order.tracking_number}&courier_code=${order.carrier}`,
      { headers: { 'Trackingmore-Api-Key': trackingApiKey } },
    )
    if (res.ok) {
      const json = await res.json()
      trackingData = json?.data?.[0] ?? null
    }
  } catch {
    // Fall through to error case
  }

  if (!trackingData) {
    return NextResponse.json({
      result: 'tracking_error',
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      message: 'Unable to retrieve tracking information. Please check with the carrier directly.',
    })
  }

  const deliveryStatus = (trackingData.delivery_status as string | undefined) ?? ''

  if (deliveryStatus === 'delivered') {
    return NextResponse.json({
      result: 'delivered',
      message: 'Tracking shows this order was delivered. If you believe this is incorrect, please contact the artist.',
      tracking: trackingData,
    })
  }

  if (deliveryStatus === 'undelivered' || deliveryStatus === 'exception') {
    // Lost — issue refund
    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent on order' }, { status: 400 })
    }

    let refund: Stripe.Refund
    try {
      refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id })
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }

    await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', id)

    await supabase.from('notifications').insert({
      user_id: order.artist_id,
      type: 'merch_dispute',
      title: 'Order lost in transit — refund issued',
      body: `${merchName} appears lost in transit. A full refund has been issued to the fan.`,
      link: '/dashboard/orders',
    })

    return NextResponse.json({ result: 'refunded', refund_id: refund.id })
  }

  // In transit or unknown
  return NextResponse.json({
    result: 'in_transit',
    message: 'Your order is still in transit. Please allow more time for delivery.',
    tracking: trackingData,
  })
}
