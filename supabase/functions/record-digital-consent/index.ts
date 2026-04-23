// Edge Function: record-digital-consent
// Anonymous. Takes a Stripe Checkout session_id and sets
// digital_content_consent_at = now() on the matching purchase.
// Called when the fan checks the cancellation-rights waiver checkbox.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const sessionId: string | undefined = body.session_id;
    if (!sessionId) return json({ error: 'session_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: purchase, error: findErr } = await admin
      .from('purchases')
      .select('id, digital_content_consent_at')
      .eq('stripe_checkout_id', sessionId)
      .eq('status', 'paid')
      .maybeSingle();

    if (findErr) return json({ error: findErr.message }, 500);
    if (!purchase) return json({ error: 'Purchase not found' }, 404);

    if (purchase.digital_content_consent_at) {
      return json({ ok: true, already_consented: true });
    }

    const { error: updateErr } = await admin
      .from('purchases')
      .update({ digital_content_consent_at: new Date().toISOString() })
      .eq('id', purchase.id);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
