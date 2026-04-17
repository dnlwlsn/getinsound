// Edge Function: connect-onboard
// Creates a Stripe Express account for the authenticated artist (if one doesn't exist),
// refreshes its onboarding status in artist_accounts, and returns either
// { onboarded: true } or { onboarded: false, url: <stripe onboarding link> }.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);
    const jwt = authHeader.replace('Bearer ', '');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const returnUrl: string = body.return_url || 'https://getinsound.com/discography';

    const { data: account, error: accountErr } = await admin
      .from('artist_accounts')
      .select('stripe_account_id, stripe_onboarded, email, country')
      .eq('id', user.id)
      .maybeSingle();
    if (accountErr || !account) return json({ error: 'Artist account not found' }, 404);

    let stripeAccountId = account.stripe_account_id;

    // Create the Express account on first call.
    if (!stripeAccountId) {
      const created = await stripe.accounts.create({
        type: 'express',
        country: account.country || 'GB',
        email: account.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { insound_artist_id: user.id },
      });
      stripeAccountId = created.id;
      await admin
        .from('artist_accounts')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', user.id);
    }

    // Refresh onboarding status from Stripe every call so the DB stays in sync.
    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    const onboarded =
      !!stripeAccount.details_submitted &&
      !!stripeAccount.charges_enabled &&
      !!stripeAccount.payouts_enabled;

    if (onboarded !== account.stripe_onboarded) {
      await admin
        .from('artist_accounts')
        .update({ stripe_onboarded: onboarded })
        .eq('id', user.id);
    }

    if (onboarded) return json({ onboarded: true });

    // Not onboarded yet — hand the artist a fresh onboarding link.
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return json({ onboarded: false, url: accountLink.url });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
