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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // 1. Find all basket checkout sessions in the window via purchases
  //    Basket purchases share a stripe_checkout_id — group by checkout to identify baskets
  const { data: recentPurchases, error: purchasesErr } = await admin
    .from('purchases')
    .select('stripe_checkout_id, artist_id, created_at')
    .gte('created_at', cutoff)
    .not('stripe_checkout_id', 'is', null)

  if (purchasesErr) {
    return NextResponse.json({ error: purchasesErr.message }, { status: 500 })
  }

  // Group by checkout ID — baskets have multiple purchases per checkout
  const checkoutMap = new Map<string, { artists: string[]; created_at: string }>()
  for (const p of recentPurchases ?? []) {
    const existing = checkoutMap.get(p.stripe_checkout_id!)
    if (existing) {
      if (p.artist_id && !existing.artists.includes(p.artist_id)) existing.artists.push(p.artist_id)
    } else {
      checkoutMap.set(p.stripe_checkout_id!, { artists: p.artist_id ? [p.artist_id] : [], created_at: p.created_at })
    }
  }

  // Only consider basket checkouts (multiple items) or include all for safety
  const sessions = [...checkoutMap.entries()].map(([checkoutId, data]) => ({
    id: checkoutId,
    checkout_session_id: checkoutId,
    created_at: data.created_at,
    artists: data.artists,
  }))

  if (sessions.length === 0) {
    return NextResponse.json({ checked: 0, issues: [], hours_back: hoursBack })
  }

  // 2. Find all transfer-failure webhook errors in the same window
  const { data: transferErrors } = await admin
    .from('webhook_errors')
    .select('event_id, error, payload')
    .gte('created_at', cutoff)
    .ilike('error', '%transfer failed%')

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

  // Also check chargeErrorBaskets and transfer errors by basket
  for (const [basketId, errors] of errorsByBasket) {
    issues.push({
      basket_session_id: basketId,
      checkout_session_id: '',
      created_at: '',
      type: 'transfer_failed',
      affected_artists: errors,
    })
  }

  for (const basketId of chargeErrorBaskets) {
    if (errorsByBasket.has(basketId)) continue
    issues.push({
      basket_session_id: basketId,
      checkout_session_id: '',
      created_at: '',
      type: 'charge_missing',
      affected_artists: [{ artist_id: 'unknown', error: 'No charge ID available' }],
    })
  }

  // 5. Spot-check: sample up to 10 recent checkouts, verify Stripe payment was captured
  const checkedBasketIds = new Set([...errorsByBasket.keys(), ...chargeErrorBaskets])
  const cleanSessions = sessions
    .filter(s => !checkedBasketIds.has(s.id))
    .slice(-10)

  for (const session of cleanSessions) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(session.checkout_session_id)
      if (stripeSession.payment_status !== 'paid') {
        issues.push({
          basket_session_id: session.id,
          checkout_session_id: session.checkout_session_id,
          created_at: session.created_at,
          type: 'payment_unconfirmed',
          affected_artists: session.artists.map(id => ({ artist_id: id })),
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

export async function POST(req: NextRequest) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const basketSessionId = body?.basket_session_id as string | undefined
  if (!basketSessionId) {
    return NextResponse.json({ error: 'basket_session_id is required' }, { status: 400 })
  }

  const admin = getAdminClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // Find failed transfer errors for this basket
  const { data: errors, error: fetchErr } = await admin
    .from('webhook_errors')
    .select('id, error, payload')
    .ilike('error', '%transfer failed%')
    .filter('payload->>basket_session_id', 'eq', basketSessionId)
    .filter('payload->>retries_exhausted', 'eq', 'true')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!errors || errors.length === 0) {
    return NextResponse.json({ message: 'No failed transfers found for this basket', retried: 0 })
  }

  const results: Array<{
    artist_id: string
    status: 'success' | 'failed'
    error?: string
  }> = []

  for (const err of errors) {
    const payload = err.payload as {
      artist_id: string
      stripe_account_id: string
      amount: number
      currency: string
      charge_id: string
      stripe_checkout_id: string
      basket_session_id: string
    } | null

    if (!payload?.stripe_account_id || !payload?.amount || !payload?.charge_id) {
      results.push({
        artist_id: payload?.artist_id || 'unknown',
        status: 'failed',
        error: 'Incomplete payload — cannot retry automatically',
      })
      continue
    }

    // Atomically claim this row — if another process already claimed it, skip
    const { data: claimed } = await admin
      .from('webhook_errors')
      .update({ error: `[RESOLVING] ${err.error}` })
      .eq('id', err.id)
      .ilike('error', '%transfer failed%')
      .select('id')
      .maybeSingle()

    if (!claimed) {
      results.push({
        artist_id: payload.artist_id,
        status: 'failed',
        error: 'Already being resolved by another process',
      })
      continue
    }

    try {
      await stripe.transfers.create({
        amount: payload.amount,
        currency: payload.currency || 'gbp',
        destination: payload.stripe_account_id,
        source_transaction: payload.charge_id,
        metadata: {
          basket_session_id: payload.basket_session_id,
          artist_id: payload.artist_id,
          retried: 'true',
        },
      }, {
        idempotencyKey: `basket_${payload.basket_session_id}_${payload.artist_id}`,
      })

      await admin
        .from('webhook_errors')
        .update({ error: `[RESOLVED] ${err.error}` })
        .eq('id', err.id)

      results.push({ artist_id: payload.artist_id, status: 'success' })
    } catch (e) {
      // Revert to original error state so it can be retried later
      await admin
        .from('webhook_errors')
        .update({ error: err.error })
        .eq('id', err.id)

      results.push({
        artist_id: payload.artist_id,
        status: 'failed',
        error: (e as Error).message,
      })
    }
  }

  return NextResponse.json({
    basket_session_id: basketSessionId,
    retried: results.length,
    results,
    ran_at: new Date().toISOString(),
  })
}
