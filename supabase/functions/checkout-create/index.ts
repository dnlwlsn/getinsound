// Edge Function: checkout-create
// Anonymous (no user auth required). Takes a release_id and returns a Stripe
// Checkout Session URL. Uses a destination charge routed to the artist's
// connected Stripe Express account with a 10% application fee for Insound.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { STANDARD_FEE_BPS, FOUNDING_ARTIST_FEE_BPS } from '../_shared/constants.ts';
import { resolveStripeCustomer } from '../_shared/stripe-customer.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const SITE_URL = Deno.env.get('SITE_URL') || 'https://getinsound.com';
const ALLOWED_ORIGINS = [SITE_URL, 'http://localhost:3000'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return {
    'Access-Control-Allow-Origin': allowedOrigin || SITE_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...(allowedOrigin ? {} : { 'X-Cors-Rejected': 'true' }),
  };
}

function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('origin') || '';
  return ALLOWED_ORIGINS.includes(origin);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isOriginAllowed(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const releaseId: string | undefined = body.release_id;
    const origin: string = body.origin || 'https://getinsound.com';
    const fanCurrency: string | undefined = body.fan_currency;
    const fanLocale: string | undefined = body.fan_locale;
    const refCode: string | undefined = body.ref_code;
    const customAmount: number | undefined = typeof body.custom_amount === 'number' ? body.custom_amount : undefined;
    if (!releaseId) return json({ error: 'release_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: release, error: relErr } = await admin
      .from('releases')
      .select(`
        id, slug, title, price_pence, currency, cover_url, published, artist_id,
        preorder_enabled, release_date, pwyw_enabled, pwyw_minimum_pence,
        artists!inner ( id, slug, name )
      `)
      .eq('id', releaseId)
      .eq('published', true)
      .maybeSingle();

    if (relErr) return json({ error: relErr.message }, 500);
    if (!release) return json({ error: 'Release not found' }, 404);

    const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists;

    const { data: account, error: accErr } = await admin
      .from('artist_accounts')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', release.artist_id)
      .maybeSingle();
    if (accErr) return json({ error: accErr.message }, 500);

    if (!account?.stripe_onboarded || !account?.stripe_account_id) {
      return json({ error: 'This artist has not finished setting up payouts yet.' }, 400);
    }

    // Check auth header for logged-in user to prevent duplicate purchases
    let stripeCustomerId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: existing } = await admin
          .from('purchases')
          .select('id')
          .eq('release_id', releaseId)
          .eq('buyer_user_id', user.id)
          .eq('status', 'paid')
          .maybeSingle();
        if (existing) {
          return json({ error: 'You already own this release.' }, 409);
        }
        if (user.email) {
          try {
            stripeCustomerId = await resolveStripeCustomer(stripe, admin, user.id, user.email);
          } catch (e) {
            console.error('Stripe customer resolution failed:', (e as Error).message);
          }
        }
      }
    }

    // Determine unit amount — support PWYW custom amounts
    let unitAmount = release.price_pence;
    if (release.pwyw_enabled && customAmount != null) {
      if (!Number.isInteger(customAmount) || customAmount <= 0) {
        return json({ error: 'custom_amount must be a positive integer (pence)' }, 400);
      }
      const minimum = release.pwyw_minimum_pence ?? release.price_pence;
      const maxAmount = release.price_pence * 50;
      if (customAmount < minimum) {
        return json({ error: `Minimum amount is ${minimum} pence` }, 400);
      }
      unitAmount = Math.min(customAmount, maxAmount);
    }
    if (!unitAmount || unitAmount < 300) {
      return json({ error: 'Invalid price' }, 400);
    }

    // Founding Artist fee: 7.5% for music if within 12-month window, else 10%
    let feeBps = STANDARD_FEE_BPS;

    const { data: faFee } = await admin
      .rpc('get_founding_artist_fee', { p_artist_id: release.artist_id })
      .maybeSingle();

    if (faFee?.is_founding) {
      const firstSale = faFee.first_sale_at;
      if (!firstSale || (Date.now() - new Date(firstSale).getTime()) < 365 * 24 * 60 * 60 * 1000) {
        feeBps = FOUNDING_ARTIST_FEE_BPS;
      }
    }

    const applicationFee = Math.round((unitAmount * feeBps) / 10000);

    // Always charge in the artist's currency to avoid FX undercharging
    const chargeCurrency = (release.currency || 'GBP').toLowerCase();

    let idempotencyBuyer = stripeCustomerId;
    if (!idempotencyBuyer) {
      const ipRaw = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw));
      idempotencyBuyer = 'anon_' + [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
    }
    const idempotencyKey = `checkout_${releaseId}_${idempotencyBuyer}_${unitAmount}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chargeCurrency,
            unit_amount: unitAmount,
            product_data: {
              name: release.title,
              description: `by ${artist.name}`,
              images: release.cover_url ? [release.cover_url] : undefined,
              metadata: {
                release_id: release.id,
                artist_id: artist.id,
              },
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: account.stripe_account_id },
        metadata: {
          release_id: release.id,
          artist_id: artist.id,
        },
      },
      metadata: {
        release_id: release.id,
        artist_id: artist.id,
        fan_currency: fanCurrency || release.currency || 'GBP',
        fan_locale: fanLocale || '',
        fee_bps: String(feeBps),
        ...(refCode ? { ref_code: refCode } : {}),
        ...(release.preorder_enabled ? { pre_order: 'true', release_date: release.release_date } : {}),
      },
    }, { idempotencyKey });

    return json({ client_secret: session.client_secret, session_id: session.id });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
