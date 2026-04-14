// Edge Function: stripe-webhook
// Receives Stripe webhook events. On checkout.session.completed, records the
// purchase and issues a download grant. Deploy with --no-verify-jwt.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const GRANT_TTL_DAYS = 7;
const GRANT_MAX_USES = 5;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature verification failed:', (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const releaseId = session.metadata?.release_id;
      const artistId = session.metadata?.artist_id;
      if (!releaseId || !artistId) {
        console.error('Missing metadata on session', session.id);
        return new Response('ok', { status: 200 });
      }

      // Idempotency: skip if we already recorded this session.
      const { data: existing } = await admin
        .from('purchases')
        .select('id')
        .eq('stripe_checkout_id', session.id)
        .maybeSingle();
      if (existing) return new Response('ok', { status: 200 });

      const amountPence = session.amount_total ?? 0;
      const platformPence = Math.round(amountPence * 0.1);
      const artistPence = amountPence - platformPence;

      // Pull the Stripe fee from the PaymentIntent's latest charge balance transaction.
      let stripeFeePence = 0;
      const piId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
      if (piId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(piId, {
            expand: ['latest_charge.balance_transaction'],
          });
          const charge = pi.latest_charge as Stripe.Charge | null;
          const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
          if (bt?.fee) stripeFeePence = bt.fee;
        } catch (e) {
          console.error('Failed to fetch balance transaction:', (e as Error).message);
        }
      }

      const { data: purchase, error: purchaseErr } = await admin
        .from('purchases')
        .insert({
          release_id: releaseId,
          artist_id: artistId,
          buyer_email: session.customer_details?.email ?? session.customer_email ?? null,
          amount_pence: amountPence,
          artist_pence: artistPence,
          platform_pence: platformPence,
          stripe_fee_pence: stripeFeePence,
          stripe_pi_id: piId ?? null,
          stripe_checkout_id: session.id,
          status: 'paid',
        })
        .select('id')
        .single();

      if (purchaseErr) {
        console.error('Purchase insert failed:', purchaseErr.message);
        return new Response(`DB Error: ${purchaseErr.message}`, { status: 500 });
      }

      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + GRANT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { error: grantErr } = await admin
        .from('download_grants')
        .insert({
          purchase_id: purchase.id,
          token,
          expires_at: expiresAt,
          max_uses: GRANT_MAX_USES,
        });
      if (grantErr) {
        console.error('Grant insert failed:', grantErr.message);
        return new Response(`DB Error: ${grantErr.message}`, { status: 500 });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Handler error:', (err as Error).message);
    return new Response(`Handler Error: ${(err as Error).message}`, { status: 500 });
  }
});
