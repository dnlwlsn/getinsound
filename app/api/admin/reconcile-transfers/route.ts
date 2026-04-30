import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { requireAdminApi } from '@/lib/admin'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const hoursBack = parseInt(req.nextUrl.searchParams.get('hours') || '72', 10)
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

  const admin = getAdminClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
  })

  // 1. Find all basket sessions in the window that completed checkout
  const { data: sessions, error: sessionsErr } = await admin
    .from('basket_sessions')
    .select('id, items, created_at, stripe_checkout_session_id')
    .gte('created_at', cutoff)
    .not('stripe_checkout_session_id', 'is', null)

  if (sessionsErr) {
    return NextResponse.json({ error: sessionsErr.message }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ checked: 0, issues: [], hours_back: hoursBack })
  }

  // 2. Find all transfer-failure webhook errors in the same window
  const { data: transferErrors } = await admin
    .from('webhook_errors')
    .select('event_id, error, payload')
    .gte('created_at', cutoff)
    .like('error', 'Transfer failed%')

  const errorsByBasket = new Map<string, Array<{ artist_id: string; error: string }>>()
  for (const err of transferErrors || []) {
    const payload = err.payload as { basket_session_id?: string; artist_id?: string } | null
    if (!payload?.basket_session_id) continue
    if (!errorsByBasket.has(payload.basket_session_id)) {
      errorsByBasket.set(payload.basket_session_id, [])
    }
    errorsByBasket.get(payload.basket_session_id)!.push({
      artist_id: payload.artist_id || 'unknown',
      error: err.error,
    })
  }

  // 3. Check for "no chargeId" errors (entire basket transfer failed)
  const { data: chargeErrors } = await admin
    .from('webhook_errors')
    .select('event_id, error, payload')
    .gte('created_at', cutoff)
    .like('error', 'No chargeId for basket%')

  const chargeErrorBaskets = new Set<string>()
  for (const err of chargeErrors || []) {
    const payload = err.payload as { basket_session_id?: string } | null
    if (payload?.basket_session_id) chargeErrorBaskets.add(payload.basket_session_id)
  }

  // 4. For each basket session, verify every artist got paid
  const issues: Array<{
    basket_session_id: string
    checkout_session_id: string
    created_at: string
    type: 'transfer_failed' | 'charge_missing' | 'payment_unconfirmed'
    affected_artists: Array<{ artist_id: string; error?: string }>
    stripe_payment_status?: string
  }> = []

  for (const session of sessions) {
    const basketId = session.id
    const checkoutId = session.stripe_checkout_session_id as string

    // Entire basket had no charge ID
    if (chargeErrorBaskets.has(basketId)) {
      const items = session.items as Array<{ artist_id: string }> | null
      issues.push({
        basket_session_id: basketId,
        checkout_session_id: checkoutId,
        created_at: session.created_at,
        type: 'charge_missing',
        affected_artists: [...new Set((items || []).map(i => i.artist_id))].map(id => ({ artist_id: id })),
      })
      continue
    }

    // Individual artist transfer failures
    const errors = errorsByBasket.get(basketId)
    if (errors && errors.length > 0) {
      issues.push({
        basket_session_id: basketId,
        checkout_session_id: checkoutId,
        created_at: session.created_at,
        type: 'transfer_failed',
        affected_artists: errors,
      })
    }
  }

  // 5. Spot-check: for any basket session without errors, verify Stripe payment was actually captured
  //    (sample up to 10 recent ones to avoid API rate limits)
  const cleanSessions = sessions
    .filter(s => !chargeErrorBaskets.has(s.id) && !errorsByBasket.has(s.id))
    .slice(-10)

  for (const session of cleanSessions) {
    const checkoutId = session.stripe_checkout_session_id as string
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(checkoutId)
      if (stripeSession.payment_status !== 'paid') {
        const items = session.items as Array<{ artist_id: string }> | null
        issues.push({
          basket_session_id: session.id,
          checkout_session_id: checkoutId,
          created_at: session.created_at,
          type: 'payment_unconfirmed',
          affected_artists: [...new Set((items || []).map(i => i.artist_id))].map(id => ({ artist_id: id })),
          stripe_payment_status: stripeSession.payment_status,
        })
      }
    } catch {
      // Session may have expired — not an issue for reconciliation
    }
  }

  // 6. Log any new issues to webhook_errors for visibility in admin
  for (const issue of issues) {
    const dedupKey = `reconcile_${issue.basket_session_id}_${issue.type}`
    const { data: existing } = await admin
      .from('webhook_errors')
      .select('id')
      .eq('event_id', dedupKey)
      .maybeSingle()

    if (!existing) {
      await admin.from('webhook_errors').insert({
        event_type: 'reconciliation',
        event_id: dedupKey,
        error: `${issue.type}: ${issue.affected_artists.length} artist(s) affected`,
        payload: issue,
      }).then(() => {}, () => {})
    }
  }

  return NextResponse.json({
    checked: sessions.length,
    issues,
    hours_back: hoursBack,
    ran_at: new Date().toISOString(),
  })
}
