// Triggered by pg_cron daily at 4am UTC.
// Retries Stripe account disconnection for settled accounts.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, stripe_account_id')
    .eq('stripe_pending_disconnect', true)
    .eq('executed', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ disconnected: 0 }));
  }

  let disconnected = 0;
  for (const request of requests) {
    if (!request.stripe_account_id) {
      await admin
        .from('account_deletion_requests')
        .update({ stripe_pending_disconnect: false })
        .eq('id', request.id);
      disconnected++;
      continue;
    }

    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: request.stripe_account_id,
      });
      const totalAvailable = balance.available.reduce((s, b) => s + b.amount, 0);
      const totalPending = balance.pending.reduce((s, b) => s + b.amount, 0);

      if (totalAvailable === 0 && totalPending === 0) {
        await stripe.accounts.del(request.stripe_account_id);
        await admin
          .from('account_deletion_requests')
          .update({ stripe_pending_disconnect: false })
          .eq('id', request.id);
        disconnected++;
      }
    } catch (e) {
      console.error(`Stripe disconnect retry failed for ${request.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ disconnected }));
});
