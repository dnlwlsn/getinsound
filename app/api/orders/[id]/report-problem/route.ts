import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'
import Stripe from 'stripe'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 5, 1)
  if (limited) return limited

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
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

    // 14+ days with no tracking — flag for admin review, notify artist
    if (order.status === 'refunded') {
      return NextResponse.json({ result: 'already_refunded', message: 'This order has already been refunded.' })
    }
    if (order.status === 'disputed') {
      return NextResponse.json({ result: 'disputed', message: 'This order is already under review.' })
    }

    await supabase
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', id)

    await supabase.from('notifications').insert({
      user_id: order.artist_id,
      type: 'merch_dispute',
      title: 'Order dispute — no tracking after 14 days',
      body: `A fan reported a problem with ${merchName}. No tracking number was provided within 14 days. Please resolve this or the order may be refunded.`,
      link: '/dashboard/orders',
    })

    return NextResponse.json({ result: 'disputed', message: 'Your report has been submitted. The artist has been notified and we will review this.' })
  }

  // Branch 2: Has tracking number but no TrackingMore API key
  const trackingApiKey = process.env.TRACKINGMORE_API_KEY
  if (!trackingApiKey) {
    const { data: artist } = await supabase
      .from('artists')
      .select('social_links')
      .eq('id', order.artist_id)
      .maybeSingle()

    const rawLinks = artist?.social_links as Record<string, { url?: string }> | null
    const safeLinks = rawLinks
      ? Object.fromEntries(Object.entries(rawLinks).map(([k, v]) => [k, { url: v?.url }]))
      : null

    return NextResponse.json({
      result: 'manual_check',
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      social_links: safeLinks,
      message: 'Please use your tracking number to check the status with the carrier, or contact the artist directly.',
    })
  }

  // Branch 3: Has tracking + TrackingMore API key — look up live status
  let trackingData: Record<string, unknown> | null = null
  try {
    const res = await fetch(
      `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${encodeURIComponent(order.tracking_number)}&courier_code=${encodeURIComponent(order.carrier)}`,
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
    if (order.status === 'refunded') {
      return NextResponse.json({ result: 'already_refunded', message: 'This order has already been refunded.' })
    }
    if (order.status === 'disputed') {
      return NextResponse.json({ result: 'disputed', message: 'This order is already under review.' })
    }

    await supabase
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', id)

    await supabase.from('notifications').insert({
      user_id: order.artist_id,
      type: 'merch_dispute',
      title: 'Order appears lost in transit',
      body: `${merchName} tracking shows "${deliveryStatus}". A fan has reported a problem. Please resolve this or the order may be refunded.`,
      link: '/dashboard/orders',
    })

    return NextResponse.json({ result: 'disputed', message: 'Your report has been submitted. The artist has been notified and we will review this.' })
  }

  // In transit or unknown
  return NextResponse.json({
    result: 'in_transit',
    message: 'Your order is still in transit. Please allow more time for delivery.',
    tracking: trackingData,
  })
}
