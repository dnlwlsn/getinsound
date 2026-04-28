// Edge Function: connect-session
// Creates a Stripe Account Session for the embedded onboarding component.
// Requires the artist to already have a Stripe account (created via connect-onboard).

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'https://getinsound.com',
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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);
    const jwt = authHeader.replace('Bearer ', '');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401);

    const { data: account } = await admin
      .from('artist_accounts')
      .select('stripe_account_id')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!account?.stripe_account_id) {
      return json({ error: 'No Stripe account yet — call connect-onboard first' }, 400);
    }

    const accountSession = await (stripe as any).accountSessions.create({
      account: account.stripe_account_id,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return json({ client_secret: accountSession.client_secret });
  } catch (err) {
    console.error('connect-session error:', err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
