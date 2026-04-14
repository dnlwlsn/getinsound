// Edge Function: checkout-create
// Anonymous (no user auth required). Takes a release_id and returns a Stripe
// Checkout Session URL. Uses a destination charge routed to the artist's
// connected Stripe Express account with a 10% application fee for Insound.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const PLATFORM_FEE_BPS = 1000; // 10.00%

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const releaseId: string | undefined = body.release_id;
    const origin: string = body.origin || 'https://getinsound.com';
    if (!releaseId) return json({ error: 'release_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: release, error: relErr } = await admin
      .from('releases')
      .select(`
        id, slug, title, price_pence, currency, cover_url, published, artist_id,
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

    const unitAmount = release.price_pence;
    if (!unitAmount || unitAmount < 200) {
      return json({ error: 'Invalid price' }, 400);
    }
    const applicationFee = Math.round((unitAmount * PLATFORM_FEE_BPS) / 10000);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (release.currency || 'GBP').toLowerCase(),
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
      },
      success_url: `${origin}/download.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/release.html?a=${artist.slug}&r=${release.slug}`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
