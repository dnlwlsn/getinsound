// Edge Function: stripe-webhook
// Receives Stripe webhook events. On checkout.session.completed:
//   1. Records the purchase and issues a download grant.
//   2. Creates a fan account if one doesn't exist (progressive creation).
//   3. Sends email via Resend — magic link for new fans, notification for existing.
// Deploy with --no-verify-jwt.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';
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
      const refCode = session.metadata?.ref_code;
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

      const buyerEmail = (
        session.customer_details?.email ?? session.customer_email ?? ''
      ).trim().toLowerCase();

      if (!buyerEmail) {
        await logWebhookError(admin, event.type, event.id, 'No buyer email on session', session);
        return new Response('ok', { status: 200 });
      }

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

      // ── Progressive fan account creation ──
      // Look up existing user first via RPC, then create if needed.
      let userId: string | null = null;
      let isNewAccount = false;

      const { data: existingUserId } = await admin.rpc('get_user_id_by_email', {
        lookup_email: buyerEmail,
      });

      if (existingUserId) {
        userId = existingUserId;
      } else {
        // No account — create one silently. The DB trigger (handle_new_user)
        // auto-creates fan_profiles, and link_purchases_to_new_user links
        // any prior purchases with this email.
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email: buyerEmail,
          email_confirm: true,
        });

        if (newUser?.user) {
          userId = newUser.user.id;
          isNewAccount = true;
        } else if (createErr) {
          await logWebhookError(admin, event.type, event.id, `User creation failed: ${createErr.message}`, { email: buyerEmail });
        }
      }

      // Insert purchase — the link_purchases_to_new_user trigger already set buyer_user_id
      // for new accounts, but we set it explicitly for existing accounts too.
      const isPreOrder = session.metadata?.pre_order === 'true';
      const preOrderReleaseDate = session.metadata?.release_date ?? null;

      const { data: purchase, error: purchaseErr } = await admin
        .from('purchases')
        .insert({
          release_id: releaseId,
          artist_id: artistId,
          buyer_email: buyerEmail,
          buyer_user_id: userId,
          amount_pence: amountPence,
          artist_pence: artistPence,
          platform_pence: platformPence,
          stripe_fee_pence: stripeFeePence,
          stripe_pi_id: piId ?? null,
          stripe_checkout_id: session.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
          pre_order: isPreOrder,
          release_date: preOrderReleaseDate,
        })
        .select('id')
        .single();

      if (purchaseErr) {
        // Duplicate stripe_pi_id or stripe_checkout_id → idempotent, return 200
        if (purchaseErr.code === '23505') return new Response('ok', { status: 200 });
        await logWebhookError(admin, event.type, event.id, `Purchase insert failed: ${purchaseErr.message}`, { releaseId, artistId });
        return new Response('ok', { status: 200 });
      }

      // Issue download grant (skip for pre-orders — grant issued on release date)
      if (!isPreOrder) {
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
          await logWebhookError(admin, event.type, event.id, `Grant insert failed: ${grantErr.message}`, { purchaseId: purchase.id });
        }
      }

      // ── Process referral for new accounts ──
      if (userId && refCode) {
        try {
          const { data: justUnlocked } = await admin.rpc('record_referral', {
            referrer_code: refCode,
            new_user_id: userId,
          });

          if (justUnlocked) {
            const { data: referrer } = await admin
              .from('fan_profiles')
              .select('id')
              .eq('referral_code', refCode)
              .single();

            if (referrer) {
              await admin.functions.invoke('notify-referral-unlock', {
                body: { user_id: referrer.id },
              });
            }
          }
        } catch (e) {
          console.error('Referral recording failed:', (e as Error).message);
        }
      }

      // ── Set zero-fees start date on first sale ──
      try {
        await admin.rpc('set_zero_fees_start', { artist_id: artistId });
      } catch (e) {
        console.error('Zero-fees start failed:', (e as Error).message);
      }

      // ── First sale milestone ──
      try {
        const { count } = await admin
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artistId)
          .eq('status', 'paid');

        if (count === 1) {
          await admin
            .from('artists')
            .update({
              milestone_first_sale: true,
              milestone_first_sale_at: new Date().toISOString(),
            })
            .eq('id', artistId);
        }
      } catch (e) {
        console.error('First sale milestone failed:', (e as Error).message);
      }

      // ── Send email via Resend ──
      // Fetch release + artist info for the email
      const { data: release } = await admin
        .from('releases')
        .select('title, artists!inner(name)')
        .eq('id', releaseId)
        .single();

      const releaseTitle = release?.title ?? 'Your purchase';
      const artistObj = Array.isArray(release?.artists) ? release.artists[0] : release?.artists;
      const artistName = artistObj?.name ?? 'the artist';

      // ── In-app notifications ──
      try {
        const salePence = amountPence;
        const saleLabel = `£${(salePence / 100).toFixed(2)}`;

        // Notify artist of sale
        await admin.from('notifications').insert({
          user_id: artistId,
          type: isPreOrder ? 'preorder' : 'sale',
          title: isPreOrder
            ? `New pre-order: ${releaseTitle}`
            : `New sale: ${releaseTitle}`,
          body: `${buyerEmail} purchased for ${saleLabel}`,
          link: '/dashboard',
        });

        // Check if this was the first sale — notify with special type
        const { count: saleCount } = await admin
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artistId)
          .eq('status', 'paid');

        if (saleCount === 1) {
          await admin.from('notifications').insert({
            user_id: artistId,
            type: 'first_sale',
            title: 'Your first sale!',
            body: `${releaseTitle} just got its first purchase. Congratulations!`,
            link: '/dashboard',
          });
        }
      } catch (e) {
        console.error('Notification insert failed:', (e as Error).message);
      }

      if (isNewAccount) {
        // Generate magic link for the new fan
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: buyerEmail,
          options: { redirectTo: `${SITE_URL}/library` },
        });

        if (linkErr) {
          await logWebhookError(admin, event.type, event.id, `Magic link generation failed: ${linkErr.message}`, { email: buyerEmail });
        } else {
          const magicLink = linkData.properties?.action_link;
          if (magicLink) {
            await sendEmail(buyerEmail, 'Your music is waiting', buildNewAccountEmail(magicLink));
          }
        }
      } else {
        await sendEmail(
          buyerEmail,
          'New music in your library',
          buildExistingAccountEmail(releaseTitle, artistName),
        );
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    const message = (err as Error).message;
    console.error('Handler error:', message);
    await logWebhookError(admin, event.type, event.id, message, null);
    return new Response('ok', { status: 200 });
  }
});

// ── Helpers ──

async function logWebhookError(
  admin: ReturnType<typeof createClient>,
  eventType: string,
  eventId: string,
  error: string,
  payload: unknown,
) {
  try {
    await admin.from('webhook_errors').insert({
      event_type: eventType,
      event_id: eventId,
      error,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    });
  } catch (e) {
    console.error('Failed to log webhook error:', (e as Error).message);
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('Resend send failed:', await res.text());
    }
  } catch (e) {
    console.error('Resend request failed:', (e as Error).message);
  }
}

function buildNewAccountEmail(magicLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          Your music is ready to listen.
        </td></tr>
        <tr><td>
          <a href="${magicLink}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildExistingAccountEmail(releaseTitle: string, artistName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          ${escapeHtml(releaseTitle)} by ${escapeHtml(artistName)} is ready to listen.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
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
