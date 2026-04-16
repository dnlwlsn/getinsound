import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: account } = await supabase
    .from('artist_accounts')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', user.id)
    .maybeSingle()

  if (!account?.stripe_account_id) {
    return NextResponse.json({ payouts: [], balance: 0, onboarded: false })
  }

  try {
    // Fetch recent payouts from connected account
    const payouts = await stripe.payouts.list(
      { limit: 20 },
      { stripeAccount: account.stripe_account_id }
    )

    // Fetch balance
    const balance = await stripe.balance.retrieve(
      { stripeAccount: account.stripe_account_id }
    )

    const availablePence = balance.available
      .filter(b => b.currency === 'gbp')
      .reduce((sum, b) => sum + b.amount, 0)

    const pendingPence = balance.pending
      .filter(b => b.currency === 'gbp')
      .reduce((sum, b) => sum + b.amount, 0)

    // Generate Express dashboard link
    let dashboardUrl = ''
    if (account.stripe_onboarded) {
      const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id)
      dashboardUrl = loginLink.url
    }

    return NextResponse.json({
      payouts: payouts.data.map(p => ({
        id: p.id,
        amount_pence: p.amount,
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
        created: new Date(p.created * 1000).toISOString(),
      })),
      balance: {
        available_pence: availablePence,
        pending_pence: pendingPence,
      },
      dashboard_url: dashboardUrl,
      onboarded: account.stripe_onboarded,
    })
  } catch (err) {
    console.error('Stripe payouts error:', err)
    return NextResponse.json({
      payouts: [],
      balance: { available_pence: 0, pending_pence: 0 },
      dashboard_url: '',
      onboarded: account.stripe_onboarded,
      error: 'Could not fetch Stripe data',
    })
  }
}
