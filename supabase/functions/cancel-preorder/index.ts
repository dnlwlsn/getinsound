// Edge Function: cancel-preorder
// Cancels a pre-order release: refunds all purchasers via Stripe,
// updates purchase status, emails affected fans, marks release cancelled.
// Requires authenticated artist who owns the release.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL,
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('authorization') ?? '';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify the caller is authenticated
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { release_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { release_id } = body;
  if (!release_id) return json({ error: 'release_id required' }, 400);

  // Verify ownership and get release info
  const { data: release } = await admin
    .from('releases')
    .select('id, title, artist_id, preorder_enabled, cancelled, artists!inner(name)')
    .eq('id', release_id)
    .single();

  if (!release || release.artist_id !== user.id) {
    return json({ error: 'Release not found' }, 404);
  }
  if (!release.preorder_enabled) {
    return json({ error: 'Release is not a pre-order' }, 400);
  }
  if (release.cancelled) {
    return json({ error: 'Release is already cancelled' }, 400);
  }

  // Get all pre-order purchases to refund
  const { data: purchases } = await admin
    .from('purchases')
    .select('id, stripe_pi_id, buyer_email, amount_pence')
    .eq('release_id', release_id)
    .eq('pre_order', true)
    .eq('status', 'paid');

  const results: { refunded: number; failed: number; errors: string[] } = {
    refunded: 0,
    failed: 0,
    errors: [],
  };
  const refundedIds = new Set<string>();

  // Refund each purchase via Stripe
  for (const purchase of purchases ?? []) {
    if (!purchase.stripe_pi_id) {
      results.failed++;
      results.errors.push(`No payment intent for purchase ${purchase.id}`);
      continue;
    }

    try {
      await stripe.refunds.create(
        { payment_intent: purchase.stripe_pi_id, refund_application_fee: true, reverse_transfer: true },
        { idempotencyKey: `cancel_preorder_${purchase.id}` },
      );
      await admin
        .from('purchases')
        .update({ status: 'refunded' })
        .eq('id', purchase.id);
      results.refunded++;
      refundedIds.add(purchase.id);
    } catch (e) {
      results.failed++;
      results.errors.push(`Refund failed for ${purchase.id}: ${(e as Error).message}`);
    }
  }

  // Only mark release as cancelled if all refunds succeeded
  if (results.failed === 0) {
    await admin
      .from('releases')
      .update({ cancelled: true, published: false })
      .eq('id', release_id);
  } else {
    // Partial failure — keep release in current state so remaining fans can be retried
    console.error(`${results.failed} refund(s) failed — release NOT marked as cancelled`);
  }

  // Email affected fans
  const artistObj = Array.isArray(release.artists) ? release.artists[0] : release.artists;
  const artistName = (artistObj as any)?.name ?? 'the artist';
  const emailBatch = (purchases ?? [])
    .filter((p) => p.buyer_email && refundedIds.has(p.id))
    .map((p) => ({
      from: 'Insound <noreply@getinsound.com>',
      to: [p.buyer_email],
      subject: 'Your pre-order has been cancelled',
      html: buildCancelEmail(release.title, artistName, p.amount_pence),
    }));

  if (emailBatch.length > 0) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailBatch),
      });
      if (!emailRes.ok) {
        console.error('Cancel notification emails failed:', await emailRes.text());
      }
    } catch (e) {
      console.error('Cancel notification emails failed:', (e as Error).message);
    }
  }

  return json({
    cancelled: true,
    refunded: results.refunded,
    failed: results.failed,
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
});

function buildCancelEmail(releaseTitle: string, artistName: string, amountPence: number, currency = 'GBP'): string {
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'C$', AUD: 'A$', JPY: '¥' };
  const sym = symbols[currency.toUpperCase()] || currency + ' ';
  const amount = `${sym}${(amountPence / 100).toFixed(currency.toUpperCase() === 'JPY' ? 0 : 2)}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          ${escapeHtml(releaseTitle)} by ${escapeHtml(artistName)} has been cancelled.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          A full refund of ${amount} has been issued. It should appear in your account within 5&ndash;10 business days.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/explore" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Discover more music &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
