// Edge Function: stripe-webhook
// Receives Stripe webhook events. On checkout.session.completed:
//   1. Records the purchase and issues a download grant.
//   2. Creates a fan account if one doesn't exist (progressive creation).
//   3. Sends email via Resend — magic link for new fans, notification for existing.
// Deploy with --no-verify-jwt.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { STANDARD_FEE_BPS } from '../_shared/constants.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';
const GRANT_TTL_DAYS = 7;
const GRANT_MAX_USES = 5;

async function getFanLabel(admin: any, userId: string | null): Promise<string> {
  if (!userId) return 'A fan';
  const { data } = await admin
    .from('fan_profiles')
    .select('username, is_public')
    .eq('id', userId)
    .maybeSingle();
  return data?.is_public && data.username ? data.username : 'A fan';
}

function formatPrice(amountPence: number, currency: string): string {
  const amount = (amountPence / 100).toFixed(2)
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
  return `${symbols[currency.toUpperCase()] || currency + ' '}${amount}`
}

function estimateStripeFee(amountPence: number, currency: string): number {
  const c = (currency || 'GBP').toUpperCase();
  if (c === 'GBP') return Math.round(amountPence * 0.015) + 20;
  if (c === 'EUR') return Math.round(amountPence * 0.015) + 25;
  return Math.round(amountPence * 0.029) + 30;
}

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

      const sessionType = session.metadata?.type;

      // ── Merch order flow ──────────────────────────────────
      if (sessionType === 'merch') {
        const merchId = session.metadata?.merch_id;
        const artistId = session.metadata?.artist_id;
        const variant = session.metadata?.variant || null;
        const fanId = session.metadata?.fan_id || null;

        if (!merchId || !artistId) {
          console.error('Missing merch metadata on session', session.id);
          return new Response('ok', { status: 200 });
        }

        // Idempotency
        const { data: existingOrder } = await admin
          .from('orders')
          .select('id')
          .eq('stripe_checkout_id', session.id)
          .maybeSingle();
        if (existingOrder) return new Response('ok', { status: 200 });

        const buyerEmail = (
          session.customer_details?.email ?? session.customer_email ?? ''
        ).trim().toLowerCase();

        const amountPaid = session.amount_total ?? 0;

        // Retrieve merch for postage info
        const { data: merchItem } = await admin
          .from('merch')
          .select('name, price, postage, currency')
          .eq('id', merchId)
          .single();

        const postagePaid = merchItem?.postage ?? 0;
        const itemAmount = amountPaid - postagePaid;
        const platformPence = Math.round(itemAmount * STANDARD_FEE_BPS / 10000);

        // Stripe fee
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
        if (stripeFeePence === 0 && amountPaid > 0) {
          const currency = session.metadata?.fan_currency || merchItem?.currency || 'GBP';
          stripeFeePence = estimateStripeFee(amountPaid, currency);
          console.warn(`Stripe fee estimated at ${stripeFeePence}p for merch session ${session.id} — fee lookup failed`);
          await logWebhookError(admin, event.type, event.id, `Merch Stripe fee estimated (lookup failed)`, { session_id: session.id, estimated_fee: stripeFeePence });
        }

        const artistReceived = amountPaid - platformPence;

        // Progressive fan creation (reuse existing pattern)
        let userId = fanId;
        if (!userId && buyerEmail) {
          const { data: existingUserId } = await admin.rpc('get_user_id_by_email', {
            lookup_email: buyerEmail,
          });
          if (existingUserId) {
            userId = existingUserId;
          } else {
            const { data: newUser } = await admin.auth.admin.createUser({
              email: buyerEmail,
              email_confirm: true,
            });
            if (newUser?.user) userId = newUser.user.id;
          }
        }

        if (!userId) {
          await logWebhookError(admin, event.type, event.id, 'No fan_id for merch order', { merchId, buyerEmail });
          return new Response('ok', { status: 200 });
        }

        // Store Stripe customer ID on fan profile for saved payment methods
        const merchCustomerId = typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id;
        if (userId && merchCustomerId) {
          await admin
            .from('fan_profiles')
            .update({ stripe_customer_id: merchCustomerId })
            .eq('id', userId)
            .is('stripe_customer_id', null);
        }

        // Extract shipping address from Stripe session
        const shippingDetails = session.shipping_details ?? session.customer_details;
        const shippingAddress = shippingDetails?.address
          ? {
              name: shippingDetails.name || '',
              line1: shippingDetails.address.line1 || '',
              line2: shippingDetails.address.line2 || '',
              city: shippingDetails.address.city || '',
              postcode: shippingDetails.address.postal_code || '',
              country: shippingDetails.address.country || '',
            }
          : {};

        // Atomic stock decrement
        const { data: updated, error: stockErr } = await admin.rpc('decrement_merch_stock', {
          merch_id: merchId,
        });

        // If stock was already 0, refund
        if (stockErr || updated === false) {
          if (piId) {
            try { await stripe.refunds.create({ payment_intent: piId, refund_application_fee: true }, { idempotencyKey: `refund_merch_${session.id}_${merchId}` }); } catch (e) {
              console.error('Refund failed:', (e as Error).message);
            }
          }
          if (userId) {
            const { error: notifErr } = await admin.from('notifications').insert({
              user_id: userId,
              type: 'merch_order',
              title: `${merchItem?.name || 'Item'} is sold out`,
              body: 'Your payment has been refunded.',
              link: '/library',
            });
            if (notifErr) console.error('Notification insert failed:', notifErr.message);
          }
          return new Response('ok', { status: 200 });
        }

        // Insert order
        const { error: orderErr } = await admin
          .from('orders')
          .insert({
            fan_id: userId,
            artist_id: artistId,
            merch_id: merchId,
            variant_selected: variant,
            amount_paid: amountPaid,
            amount_paid_currency: merchItem?.currency || 'GBP',
            artist_received: artistReceived,
            artist_received_currency: merchItem?.currency || 'GBP',
            platform_pence: platformPence,
            stripe_fee_pence: stripeFeePence,
            postage_paid: postagePaid,
            shipping_address: shippingAddress,
            status: 'pending',
            stripe_payment_intent_id: piId ?? null,
            stripe_checkout_id: session.id,
          });

        if (orderErr) {
          if (orderErr.code === '23505') return new Response('ok', { status: 200 });
          await logWebhookError(admin, event.type, event.id, `Order insert failed: ${orderErr.message}`, { merchId, artistId });
          return new Response('ok', { status: 200 });
        }

        // Standalone merch uses destination charges (transfer_data.destination)
        // in checkout-merch-create, so Stripe automatically transfers
        // (amount - application_fee) to the artist. No manual transfer needed.

        // Check if stock hit 0
        const { data: currentMerch } = await admin
          .from('merch')
          .select('stock')
          .eq('id', merchId)
          .single();

        if (currentMerch?.stock === 0 && await shouldNotifyInApp(admin, artistId, 'merch_order')) {
          const { error: notifErr } = await admin.from('notifications').insert({
            user_id: artistId,
            type: 'merch_order',
            title: `${merchItem?.name || 'Item'} is now sold out`,
            link: '/dashboard',
          });
          if (notifErr) console.error('Notification insert failed:', notifErr.message);
        }

        // Notify artist (in-app, respecting preferences)
        const merchFanLabel = await getFanLabel(admin, userId);
        if (await shouldNotifyInApp(admin, artistId, 'merch_order')) {
          const { error: notifErr } = await admin.from('notifications').insert({
            user_id: artistId,
            type: 'merch_order',
            title: `New merch order: ${merchItem?.name || 'Unknown item'}`,
            body: `${merchFanLabel} ordered${variant ? ` (${variant})` : ''}.`,
            link: '/dashboard',
          });
          if (notifErr) console.error('Notification insert failed:', notifErr.message);
        }

        // Email artist (respecting preferences)
        if (await shouldNotifyEmail(admin, artistId, 'merch_order')) {
          const { data: artistRow } = await admin
            .from('artists')
            .select('email, name')
            .eq('id', artistId)
            .single();
          if (artistRow?.email) {
            const itemName = merchItem?.name || 'Unknown item';
            const variantLine = variant ? ` (${escapeHtml(variant)})` : '';
            await sendEmail(
              artistRow.email,
              `New merch order: ${itemName}`,
              buildMerchOrderArtistEmail(itemName, merchFanLabel, variantLine),
            );
          }
        }

        // Notify fan (in-app, respecting preferences)
        if (userId && await shouldNotifyInApp(admin, userId, 'merch_order')) {
          const { error: notifErr } = await admin.from('notifications').insert({
            user_id: userId,
            type: 'merch_order',
            title: `Order confirmed: ${merchItem?.name || 'Your order'}`,
            body: 'You\'ll be notified when it ships.',
            link: '/library',
          });
          if (notifErr) console.error('Notification insert failed:', notifErr.message);
        }

        // Email fan
        await sendEmail(
          buyerEmail,
          `Order confirmed: ${merchItem?.name || 'Your order'}`,
          buildMerchOrderEmail(merchItem?.name || 'Your order', variant),
        );

        // Auto-follow artist on merch purchase
        if (userId) {
          await admin
            .from('fan_follows')
            .upsert(
              { user_id: userId, artist_id: artistId },
              { onConflict: 'user_id,artist_id' },
            )
            .then(() => {})
            .catch((e: Error) => console.error('Auto-follow failed:', e.message));
        }

        return new Response('ok', { status: 200 });
      }

      // ── Basket (multi-artist) order flow ──────────────────────
      if (sessionType === 'basket') {
        const basketSessionId = session.metadata?.basket_session_id;
        if (!basketSessionId) {
          console.error('Missing basket_session_id on session', session.id);
          return new Response('ok', { status: 200 });
        }

        // Idempotency — check both purchases and orders for merch-only baskets
        const [{ data: existingBasketPurchase }, { data: existingBasketOrder }] = await Promise.all([
          admin.from('purchases').select('id').eq('stripe_checkout_id', session.id).maybeSingle(),
          admin.from('orders').select('id').eq('stripe_checkout_id', session.id).maybeSingle(),
        ]);
        const basketAlreadyProcessed = !!(existingBasketPurchase || existingBasketOrder);
        // If transfers already succeeded previously, we're fully idempotent
        if (basketAlreadyProcessed) {
          const { data: pendingErrors } = await admin
            .from('webhook_errors')
            .select('id')
            .filter('payload->>basket_session_id', 'eq', basketSessionId)
            .or('error.ilike.%transfer failed%,error.ilike.%No chargeId%')
            .not('error', 'ilike', '%RESOLVED%')
            .limit(1);
          if (!pendingErrors || pendingErrors.length === 0) {
            return new Response('ok', { status: 200 });
          }
          // Transfers still pending — fall through to retry them
        }

        const { data: basketSession } = await admin
          .from('basket_sessions')
          .select('items, fan_currency, ref_code')
          .eq('id', basketSessionId)
          .single();

        if (!basketSession) {
          await logWebhookError(admin, event.type, event.id, 'Basket session not found', { basketSessionId });
          return new Response('ok', { status: 200 });
        }

        const basketItems = basketSession.items as any[];
        for (const item of basketItems) {
          if (!item.type) item.type = 'release';
        }
        const refCode = basketSession.ref_code;
        const buyerEmail = (
          session.customer_details?.email ?? session.customer_email ?? ''
        ).trim().toLowerCase();

        if (!buyerEmail) {
          await logWebhookError(admin, event.type, event.id, 'No buyer email on basket session', session);
          return new Response('ok', { status: 200 });
        }

        // Get charge ID for transfers
        const piId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

        let chargeId: string | null = null;
        let stripeFeePence = 0;
        if (piId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId, {
              expand: ['latest_charge.balance_transaction'],
            });
            const charge = pi.latest_charge as Stripe.Charge | null;
            chargeId = charge?.id ?? null;
            const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
            if (bt?.fee) stripeFeePence = bt.fee;
          } catch (e) {
            console.error('Failed to fetch charge for basket:', (e as Error).message);
          }
        }

        // Skip purchase/order creation on retry — only need to redo transfers
        const refundedItemIndices = new Set<number>();
        let userId: string | null = null;
        let isNewAccount = false;
        let purchasedTitles: string[] = [];

        if (basketAlreadyProcessed) {
          // On retry, we just need userId for email and chargeId for transfers
          const { data: existingUserId } = await admin.rpc('get_user_id_by_email', {
            lookup_email: buyerEmail,
          });
          userId = existingUserId;
        }

        if (!basketAlreadyProcessed) {
        // Progressive fan account creation

        const { data: existingUserId } = await admin.rpc('get_user_id_by_email', {
          lookup_email: buyerEmail,
        });

        if (existingUserId) {
          userId = existingUserId;
        } else {
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

        // Store Stripe customer ID on fan profile for saved payment methods
        const basketCustomerId = typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id;
        if (userId && basketCustomerId) {
          await admin
            .from('fan_profiles')
            .update({ stripe_customer_id: basketCustomerId })
            .eq('id', userId)
            .is('stripe_customer_id', null);
        }

        const basketFanLabel = await getFanLabel(admin, userId);

        // Distribute Stripe fee proportionally
        const totalAmount = basketItems.reduce((s: number, i: any) => {
          if (i.type === 'merch') return s + i.amount_pence + i.postage_pence;
          return s + i.amount_pence;
        }, 0);
        // Process each item
        for (let idx = 0; idx < basketItems.length; idx++) {
          const item = basketItems[idx];
          const itemAmount = item.type === 'merch' ? item.amount_pence + item.postage_pence : item.amount_pence;
          const itemFraction = totalAmount > 0 ? itemAmount / totalAmount : 1 / basketItems.length;
          const itemStripeFee = idx === basketItems.length - 1
            ? stripeFeePence - basketItems.slice(0, -1).reduce((s: number, _: any, j: number) => {
                const jItem = basketItems[j];
                const jAmount = jItem.type === 'merch' ? jItem.amount_pence + jItem.postage_pence : jItem.amount_pence;
                return s + Math.round(stripeFeePence * (totalAmount > 0 ? jAmount / totalAmount : 1 / basketItems.length));
              }, 0)
            : Math.round(stripeFeePence * itemFraction);

          if (item.type === 'release') {
            const feeBps = item.fee_bps || STANDARD_FEE_BPS;
            const platformPence = Math.round(item.amount_pence * feeBps / 10000);
            const artistPence = item.amount_pence - platformPence;

            // Fetch release title
            const { data: release } = await admin
              .from('releases')
              .select('title, preorder_enabled, release_date, artists!inner(name)')
              .eq('id', item.release_id)
              .single();

            const releaseTitle = release?.title ?? 'Unknown';
            purchasedTitles.push(releaseTitle);
            const isPreOrder = release?.preorder_enabled && release?.release_date && new Date(release.release_date) > new Date();

            // Insert purchase
            const { data: purchase, error: purchaseErr } = await admin
              .from('purchases')
              .insert({
                release_id: item.release_id,
                artist_id: item.artist_id,
                buyer_email: buyerEmail,
                buyer_user_id: userId,
                amount_pence: item.amount_pence,
                artist_pence: artistPence,
                platform_pence: platformPence,
                stripe_fee_pence: itemStripeFee,
                stripe_pi_id: piId ?? null,
                stripe_checkout_id: session.id,
                status: 'paid',
                paid_at: new Date().toISOString(),
                pre_order: !!isPreOrder,
                release_date: isPreOrder ? release!.release_date : null,
              })
              .select('id')
              .single();

            if (purchaseErr) {
              if (purchaseErr.code === '23505') continue;
              await logWebhookError(admin, event.type, event.id, `Basket purchase insert failed: ${purchaseErr.message}`, { item });
              continue;
            }

            // Download grant (skip pre-orders)
            if (!isPreOrder && purchase) {
              const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
              const expiresAt = new Date(Date.now() + GRANT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
              await admin
                .from('download_grants')
                .insert({
                  purchase_id: purchase.id,
                  token,
                  expires_at: expiresAt,
                  max_uses: GRANT_MAX_USES,
                });
            }

            // Notify artist
            const saleLabel = formatPrice(item.amount_pence, basketSession.fan_currency || session.currency || 'GBP');
            {
              const { error: notifErr } = await admin.from('notifications').insert({
                user_id: item.artist_id,
                type: isPreOrder ? 'preorder' : 'sale',
                title: isPreOrder
                  ? `New pre-order: ${releaseTitle}`
                  : `New sale: ${releaseTitle}`,
                body: `${basketFanLabel} purchased for ${saleLabel}`,
                link: '/dashboard',
              });
              if (notifErr) console.error('Notification insert failed:', notifErr.message);
            }

            // Founding Artist: record first sale timestamp
            try {
              await admin.rpc('set_founding_artist_first_sale', {
                p_artist_id: item.artist_id,
                p_sale_at: new Date().toISOString(),
              });
            } catch (e) {
              console.error('Founding Artist first sale failed:', (e as Error).message);
            }

            // Auto-follow artist on purchase
            if (userId) {
              await admin
                .from('fan_follows')
                .upsert(
                  { user_id: userId, artist_id: item.artist_id },
                  { onConflict: 'user_id,artist_id' },
                )
                .then(() => {})
                .catch((e: Error) => console.error('Auto-follow failed:', e.message));
            }
          } else if (item.type === 'merch') {
            const platformPence = Math.round(item.amount_pence * STANDARD_FEE_BPS / 10000);
            const artistPence = item.amount_pence + item.postage_pence - platformPence;

            const { data: merchItem } = await admin
              .from('merch')
              .select('name, price, postage, currency')
              .eq('id', item.merch_id)
              .single();

            const itemName = item.variant ? `${merchItem?.name ?? 'Item'} (${item.variant})` : (merchItem?.name ?? 'Item');
            purchasedTitles.push(itemName);

            // Shipping address from Stripe session
            const shippingDetails = session.shipping_details ?? session.customer_details;
            const shippingAddress = shippingDetails?.address
              ? {
                  name: shippingDetails.name || '',
                  line1: shippingDetails.address.line1 || '',
                  line2: shippingDetails.address.line2 || '',
                  city: shippingDetails.address.city || '',
                  postcode: shippingDetails.address.postal_code || '',
                  country: shippingDetails.address.country || '',
                }
              : {};

            // Atomic stock decrement
            const { data: updated, error: stockErr } = await admin.rpc('decrement_merch_stock', {
              merch_id: item.merch_id,
            });

            if (stockErr || updated === false) {
              refundedItemIndices.add(idx);
              const refundAmount = item.amount_pence + (item.postage_pence || 0);
              if (piId && refundAmount > 0) {
                try {
                  await stripe.refunds.create({ payment_intent: piId, amount: refundAmount, refund_application_fee: true }, { idempotencyKey: `refund_basket_${session.id}_${item.merch_id}` });
                } catch (e) {
                  console.error('Basket merch refund failed:', (e as Error).message);
                  await logWebhookError(admin, event.type, event.id, `Basket merch refund failed: ${(e as Error).message}`, { merch_id: item.merch_id, refundAmount });
                }
              }
              if (userId) {
                const { error: notifErr } = await admin.from('notifications').insert({
                  user_id: userId,
                  type: 'merch_order',
                  title: `${itemName} is sold out`,
                  body: 'This item from your basket could not be fulfilled. A refund has been issued.',
                  link: '/library',
                });
                if (notifErr) console.error('Notification insert failed:', notifErr.message);
              }
              await logWebhookError(admin, event.type, event.id, 'Merch sold out during basket checkout — refund issued', { merch_id: item.merch_id });
              continue;
            }

            // Insert order
            const { error: orderErr } = await admin
              .from('orders')
              .insert({
                fan_id: userId,
                artist_id: item.artist_id,
                merch_id: item.merch_id,
                variant_selected: item.variant,
                amount_paid: item.amount_pence + item.postage_pence,
                amount_paid_currency: merchItem?.currency || 'GBP',
                artist_received: artistPence,
                artist_received_currency: merchItem?.currency || 'GBP',
                platform_pence: platformPence,
                stripe_fee_pence: itemStripeFee,
                postage_paid: item.postage_pence,
                shipping_address: shippingAddress,
                status: 'pending',
                stripe_payment_intent_id: piId ?? null,
                stripe_checkout_id: session.id,
              });

            if (orderErr) {
              if (orderErr.code === '23505') continue;
              await logWebhookError(admin, event.type, event.id, `Basket merch order insert failed: ${orderErr.message}`, { item });
              continue;
            }

            // Notify artist
            if (await shouldNotifyInApp(admin, item.artist_id, 'merch_order')) {
              const { error: notifErr } = await admin.from('notifications').insert({
                user_id: item.artist_id,
                type: 'merch_order',
                title: `New merch order: ${itemName}`,
                body: `${basketFanLabel} ordered${item.variant ? ` (${item.variant})` : ''}.`,
                link: '/dashboard',
              });
              if (notifErr) console.error('Notification insert failed:', notifErr.message);
            }

            if (await shouldNotifyEmail(admin, item.artist_id, 'merch_order')) {
              const { data: artistRow } = await admin
                .from('artists')
                .select('email, name')
                .eq('id', item.artist_id)
                .single();
              if (artistRow?.email) {
                await sendEmail(
                  artistRow.email,
                  `New merch order: ${itemName}`,
                  buildMerchOrderArtistEmail(itemName, basketFanLabel, item.variant ? ` (${item.variant})` : ''),
                );
              }
            }

            // Auto-follow artist on merch purchase
            if (userId) {
              await admin
                .from('fan_follows')
                .upsert(
                  { user_id: userId, artist_id: item.artist_id },
                  { onConflict: 'user_id,artist_id' },
                )
                .then(() => {})
                .catch((e: Error) => console.error('Auto-follow failed:', e.message));
            }

            // Notify fan
            if (userId && await shouldNotifyInApp(admin, userId, 'merch_order')) {
              const { error: notifErr } = await admin.from('notifications').insert({
                user_id: userId,
                type: 'merch_order',
                title: `Order confirmed: ${itemName}`,
                body: "You'll be notified when it ships.",
                link: '/library',
              });
              if (notifErr) console.error('Notification insert failed:', notifErr.message);
            }
          }
        }

        // Founding fan badge
        if (userId) {
          try {
            const { data: alreadyHas } = await admin
              .from('fan_badges')
              .select('id')
              .eq('user_id', userId)
              .eq('badge_type', 'founding_fan')
              .maybeSingle();

            if (!alreadyHas) {
              const { data: distinctResult } = await admin.rpc('count_distinct_purchasers');
              const distinctCount = distinctResult ?? 0;
              if (distinctCount <= 1000) {
                await admin.from('fan_badges').insert({
                  user_id: userId,
                  badge_type: 'founding_fan',
                  metadata: { position: distinctCount },
                });
              }
            }
          } catch (e) {
            console.error('Founding fan badge failed:', (e as Error).message);
          }
        }
        } // end if (!basketAlreadyProcessed)

        // ── Create transfers to each artist's Connect account ──
        // Group earnings by artist, then create one transfer per artist.
        // Exclude items that were refunded (e.g. merch out of stock).
        const artistTransfers = new Map<string, { stripeAccountId: string; amount: number }>();
        for (let i = 0; i < basketItems.length; i++) {
          if (refundedItemIndices.has(i)) continue;
          const item = basketItems[i];
          const artistId = item.artist_id;
          const stripeAccountId = item.stripe_account_id;
          if (!stripeAccountId) continue;

          let artistAmount: number;
          if (item.type === 'merch') {
            const platformPence = Math.round(item.amount_pence * STANDARD_FEE_BPS / 10000);
            artistAmount = item.amount_pence + (item.postage_pence || 0) - platformPence;
          } else {
            const feeBps = item.fee_bps || STANDARD_FEE_BPS;
            const platformPence = Math.round(item.amount_pence * feeBps / 10000);
            artistAmount = item.amount_pence - platformPence;
          }

          const existing = artistTransfers.get(artistId);
          if (existing) {
            existing.amount += artistAmount;
          } else {
            artistTransfers.set(artistId, { stripeAccountId, amount: artistAmount });
          }
        }

        if (!chargeId) {
          await logWebhookError(admin, event.type, event.id, 'No chargeId for basket transfers — artists unpaid', {
            basket_session_id: basketSessionId,
            pi_id: piId,
          });
          return new Response('Missing charge ID', { status: 500 });
        }

        let anyTransferFailed = false;
        for (const [artistId, { stripeAccountId, amount }] of artistTransfers) {
          if (amount <= 0) continue;

          const MAX_RETRIES = 3;
          let transferSuccess = false;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              await stripe.transfers.create({
                amount,
                currency: session.currency || 'gbp',
                destination: stripeAccountId,
                source_transaction: chargeId,
                metadata: {
                  basket_session_id: basketSessionId,
                  artist_id: artistId,
                },
              }, {
                idempotencyKey: `basket_${basketSessionId}_${artistId}`,
              });
              transferSuccess = true;
              break;
            } catch (e) {
              const errMsg = (e as Error).message;
              console.error(`Transfer to ${stripeAccountId} attempt ${attempt}/${MAX_RETRIES} failed:`, errMsg);

              if (attempt < MAX_RETRIES) {
                const delayMs = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }
          }

          if (!transferSuccess) {
            anyTransferFailed = true;
            console.error(`Transfer to ${stripeAccountId} failed after ${MAX_RETRIES} attempts — logging for manual retry`);
            await logWebhookError(admin, event.type, event.id, `Transfer failed for artist ${artistId} after ${MAX_RETRIES} retries`, {
              basket_session_id: basketSessionId,
              artist_id: artistId,
              stripe_account_id: stripeAccountId,
              stripe_checkout_id: session.id,
              amount,
              currency: session.currency || 'gbp',
              charge_id: chargeId,
              retries_exhausted: true,
            });
          }
        }

        if (anyTransferFailed) {
          console.error('One or more transfers failed — logged for manual reconciliation via /api/admin/reconcile-transfers');
        }

        // Email
        if (isNewAccount) {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: buyerEmail,
            options: { redirectTo: `${SITE_URL}/library` },
          });
          const magicLink = linkData?.properties?.action_link;
          if (magicLink) {
            await sendEmail(buyerEmail, 'Your music is ready', buildNewAccountEmail(magicLink, userId));
          }
        } else {
          await sendEmail(
            buyerEmail,
            'New music in your library',
            buildBasketReceiptEmail(purchasedTitles, session.amount_total ?? 0, basketSession.fan_currency || session.currency || 'GBP', userId),
          );
        }

        return new Response('ok', { status: 200 });
      }

      // ── Existing release purchase flow ──────────────────────
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

      // Stripe amount_total is always in the smallest currency unit
      // (pence for GBP, cents for USD, whole yen for JPY). Store as-is.
      const amountPence = session.amount_total ?? 0;
      const feeBps = parseInt(session.metadata?.fee_bps ?? '', 10) || STANDARD_FEE_BPS;
      const platformPence = Math.round(amountPence * feeBps / 10000);
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
      if (stripeFeePence === 0 && amountPence > 0) {
        const currency = session.metadata?.fan_currency || 'GBP';
        stripeFeePence = estimateStripeFee(amountPence, currency);
        console.warn(`Stripe fee estimated at ${stripeFeePence}p for session ${session.id} — fee lookup failed`);
        await logWebhookError(admin, event.type, event.id, `Stripe fee estimated (lookup failed)`, { session_id: session.id, estimated_fee: stripeFeePence });
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

      // Store Stripe customer ID on fan profile for saved payment methods
      const sessionCustomerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id;
      if (userId && sessionCustomerId) {
        await admin
          .from('fan_profiles')
          .update({ stripe_customer_id: sessionCustomerId })
          .eq('id', userId)
          .is('stripe_customer_id', null);
      }

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
        if (purchaseErr.code === '23505') return new Response('ok', { status: 200 });
        await logWebhookError(admin, event.type, event.id, `Purchase insert failed: ${purchaseErr.message}`, { releaseId, artistId });
        return new Response('Purchase insert failed', { status: 500 });
      }

      // Check for rapid-fire transactions
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count: recentTxCount } = await admin
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistId)
        .gte('created_at', oneHourAgo)

      if ((recentTxCount || 0) > 50) {
        await upsertFlag(admin, artistId, 'rapid_transactions', {
          transaction_count: recentTxCount,
          window_hours: 1,
        })
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

      // ── Founding Artist: record first sale timestamp ──
      try {
        await admin.rpc('set_founding_artist_first_sale', {
          p_artist_id: artistId,
          p_sale_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Founding Artist first sale failed:', (e as Error).message);
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

          await admin
            .from('fan_badges')
            .upsert(
              { user_id: artistId, badge_type: 'first_sale', release_id: releaseId },
              { onConflict: 'user_id,badge_type,release_id' },
            );
        }
      } catch (e) {
        console.error('First sale milestone failed:', (e as Error).message);
      }

      // ── Founding Fan badge (first 1,000 distinct purchasers) ──
      if (userId) {
        try {
          const { data: alreadyHas } = await admin
            .from('fan_badges')
            .select('id')
            .eq('user_id', userId)
            .eq('badge_type', 'founding_fan')
            .maybeSingle();

          if (!alreadyHas) {
            // Count distinct users who have made a purchase (including this one)
            const { data: distinctResult } = await admin
              .rpc('count_distinct_purchasers');
            const distinctCount = distinctResult ?? 0;

            if (distinctCount <= 1000) {
              await admin
                .from('fan_badges')
                .insert({
                  user_id: userId,
                  badge_type: 'founding_fan',
                  metadata: { position: distinctCount },
                });
            }
          }
        } catch (e) {
          console.error('Founding fan badge failed:', (e as Error).message);
        }
      }

      // Auto-follow artist on purchase
      if (userId) {
        await admin
          .from('fan_follows')
          .upsert(
            { user_id: userId, artist_id: artistId },
            { onConflict: 'user_id,artist_id' },
          )
          .then(() => {})
          .catch((e: Error) => console.error('Auto-follow failed:', e.message));
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
        const saleLabel = formatPrice(salePence, session.metadata?.fan_currency || session.currency || 'GBP');
        const singleFanLabel = await getFanLabel(admin, userId);

        // Notify artist of sale
        {
          const { error: notifErr } = await admin.from('notifications').insert({
            user_id: artistId,
            type: isPreOrder ? 'preorder' : 'sale',
            title: isPreOrder
              ? `New pre-order: ${releaseTitle}`
              : `New sale: ${releaseTitle}`,
            body: `${singleFanLabel} purchased for ${saleLabel}`,
            link: '/dashboard',
          });
          if (notifErr) console.error('Notification insert failed:', notifErr.message);
        }

        // Check if this was the first sale — notify with special type
        const { count: saleCount } = await admin
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artistId)
          .eq('status', 'paid');

        if (saleCount === 1) {
          const { error: notifErr } = await admin.from('notifications').insert({
            user_id: artistId,
            type: 'first_sale',
            title: 'Your first sale!',
            body: `${releaseTitle} just got its first purchase. Congratulations!`,
            link: '/dashboard',
          });
          if (notifErr) console.error('Notification insert failed:', notifErr.message);
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
            await sendEmail(buyerEmail, 'Your music is ready', buildNewAccountEmail(magicLink, userId));
          }
        }
      } else {
        await sendEmail(
          buyerEmail,
          'Purchase receipt — ' + releaseTitle,
          buildPurchaseReceiptEmail(releaseTitle, artistName, amountPence, session.metadata?.fan_currency || session.currency || 'GBP', userId),
        );
      }
    } else if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;

      if (account.charges_enabled && account.payouts_enabled) {
        const { data: artistAccount } = await admin
          .from('artist_accounts')
          .select('id')
          .eq('stripe_account_id', account.id)
          .maybeSingle();

        if (artistAccount) {
          await admin
            .from('artist_accounts')
            .update({
              stripe_verified: true,
              stripe_verified_at: new Date().toISOString(),
            })
            .eq('id', artistAccount.id);

          // Check Founding Artist eligibility: Stripe now verified, check for published release
          try {
            const { data: hasRelease } = await admin
              .from('releases')
              .select('id')
              .eq('artist_id', artistAccount.id)
              .eq('published', true)
              .limit(1)
              .maybeSingle();

            if (hasRelease) {
              await admin.rpc('confirm_founding_artist', { artist_id: artistAccount.id });
            }
          } catch (e) {
            console.error('Founding Artist confirmation failed:', (e as Error).message);
          }
        }
      }
    } else if (event.type === 'account.application.deauthorized') {
      const account = event.data.object as Stripe.Account;
      const { data: artistAccount } = await admin
        .from('artist_accounts')
        .select('id')
        .eq('stripe_account_id', account.id)
        .maybeSingle();

      if (artistAccount) {
        await admin
          .from('artist_accounts')
          .update({ stripe_onboarded: false })
          .eq('id', artistAccount.id);
        console.log(`Artist ${artistAccount.id} deauthorized — stripe_onboarded set to false`);
        await logWebhookError(admin, event.type, event.id, `Artist ${artistAccount.id} deauthorized their Stripe Connect account`, { stripe_account_id: account.id });

        // Check for pending basket sessions referencing this account
        const { data: pendingSessions } = await admin
          .from('basket_sessions')
          .select('id')
          .eq('status', 'pending')
          .filter('items', 'cs', JSON.stringify([{ stripe_account_id: account.id }]));

        if (pendingSessions && pendingSessions.length > 0) {
          await logWebhookError(admin, event.type, event.id,
            `${pendingSessions.length} pending basket session(s) reference deauthorized account`,
            { stripe_account_id: account.id, basket_session_ids: pendingSessions.map(s => s.id) });
        }
      }

    } else if (event.type === 'charge.dispute.created') {
      const dispute = event.data.object;
      const paymentIntent = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id;

      if (paymentIntent) {
        const { data: purchase } = await admin
          .from('purchases')
          .select('artist_id')
          .eq('stripe_pi_id', paymentIntent)
          .maybeSingle()

        // Mark the purchase as disputed
        await admin
          .from('purchases')
          .update({ status: 'disputed' })
          .eq('stripe_pi_id', paymentIntent)

        const { data: order } = await admin
          .from('orders')
          .select('artist_id')
          .eq('stripe_payment_intent_id', paymentIntent)
          .maybeSingle();

        const disputeArtistId = purchase?.artist_id || order?.artist_id;
        if (disputeArtistId) {
          await logWebhookError(admin, event.type, event.id, `Dispute opened for artist ${disputeArtistId} — transfer reversal deferred until outcome`, { paymentIntent, artistId: disputeArtistId, dispute_id: dispute.id });
        }

        if (purchase?.artist_id) {
          const artistId = purchase.artist_id
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

          const { count: disputeCount } = await admin
            .from('purchases')
            .select('id', { count: 'exact', head: true })
            .eq('artist_id', artistId)
            .eq('status', 'disputed')
            .gte('created_at', thirtyDaysAgo)

          const { count: totalCount } = await admin
            .from('purchases')
            .select('id', { count: 'exact', head: true })
            .eq('artist_id', artistId)
            .gte('created_at', thirtyDaysAgo)

          const chargebacks = disputeCount || 1
          const total = totalCount || 1
          const rate = chargebacks / total

          if (chargebacks > 10) {
            await upsertFlag(admin, artistId, 'chargeback_volume', {
              chargeback_count: chargebacks,
              window_days: 30,
            })
          }

          if (rate > 0.02) {
            await upsertFlag(admin, artistId, 'high_chargeback_rate', {
              chargeback_count: chargebacks,
              total_purchases: total,
              rate: Math.round(rate * 10000) / 100,
              window_days: 30,
            })
          }
        }
      }

    } else if (event.type === 'charge.dispute.closed') {
      const dispute = event.data.object;
      const status = dispute.status; // 'won', 'lost', 'warning_closed'
      const paymentIntent = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id;

      if (paymentIntent && status === 'lost') {
        // Dispute lost — reverse the artist transfer to recover funds
        const { data: purchase } = await admin
          .from('purchases')
          .select('artist_id')
          .eq('stripe_pi_id', paymentIntent)
          .maybeSingle();

        const { data: order } = await admin
          .from('orders')
          .select('artist_id')
          .eq('stripe_payment_intent_id', paymentIntent)
          .maybeSingle();

        const artistId = purchase?.artist_id || order?.artist_id;
        if (artistId) {
          const { data: account } = await admin
            .from('artist_accounts')
            .select('stripe_account_id')
            .eq('id', artistId)
            .maybeSingle();

          if (account?.stripe_account_id) {
            try {
              const charge = await stripe.charges.list({ payment_intent: paymentIntent, limit: 1 });
              const chargeId = charge.data[0]?.id;
              if (chargeId) {
                const transfers = await stripe.transfers.list({ destination: account.stripe_account_id, limit: 100 });
                const matchingTransfers = transfers.data.filter((t: Stripe.Transfer) => t.source_transaction === chargeId);
                for (const transfer of matchingTransfers) {
                  await stripe.transfers.createReversal(transfer.id, {
                    metadata: { reason: 'dispute_lost', dispute_id: dispute.id },
                  }, { idempotencyKey: `dispute_reversal_${transfer.id}_${event.id}` });
                  console.log(`Reversed transfer ${transfer.id} for lost dispute ${dispute.id}`);
                }
              }
            } catch (e) {
              console.error(`Dispute transfer reversal failed:`, (e as Error).message);
              await logWebhookError(admin, event.type, event.id, `Dispute transfer reversal failed: ${(e as Error).message}`, { paymentIntent, artistId });
            }
          }

          // Update purchase status
          await admin
            .from('purchases')
            .update({ status: 'refunded' })
            .eq('stripe_pi_id', paymentIntent);
        }
      } else if (paymentIntent && status === 'won') {
        // Dispute won — restore purchase status
        await admin
          .from('purchases')
          .update({ status: 'paid' })
          .eq('stripe_pi_id', paymentIntent)
          .eq('status', 'disputed');
      }

    } else if (event.type === 'payout.paid' || event.type === 'payout.failed') {
      const payout = event.data.object;
      const stripeAccountId = (event as any).account;

      if (stripeAccountId) {
        const { data: account } = await admin
          .from('artist_accounts')
          .select('id')
          .eq('stripe_account_id', stripeAccountId)
          .maybeSingle()

        if (account) {
          const status = event.type === 'payout.paid' ? 'paid' : 'failed'

          await admin
            .from('payout_events')
            .upsert({
              user_id: account.id,
              stripe_payout_id: payout.id,
              status,
              failure_reason: (payout as any).failure_message || null,
            }, { onConflict: 'stripe_payout_id' })

          if (status === 'failed') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { count: failedCount } = await admin
              .from('payout_events')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', account.id)
              .eq('status', 'failed')
              .gte('created_at', thirtyDaysAgo)

            if ((failedCount || 0) >= 3) {
              await upsertFlag(admin, account.id, 'failed_payouts', {
                failed_count: failedCount,
                latest_reason: (payout as any).failure_message || 'unknown',
                window_days: 30,
              })
            }
          }
        }
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : (charge.payment_intent as Stripe.PaymentIntent | null)?.id;

      if (!paymentIntent) {
        await logWebhookError(admin, event.type, event.id, 'No payment_intent on refunded charge', { charge_id: charge.id });
        return new Response('ok', { status: 200 });
      }

      // Refund the application fee so artists aren't double-penalised
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntent, {
          expand: ['latest_charge.application_fee'],
        });
        const latestCharge = pi.latest_charge as Stripe.Charge | null;
        const appFee = (latestCharge as any)?.application_fee as { id: string } | null;
        if (appFee?.id) {
          await stripe.applicationFees.createRefund(appFee.id, {}, { idempotencyKey: `app_fee_refund_${event.id}` });
        }
      } catch (e) {
        console.error('Application fee refund failed:', (e as Error).message);
        await logWebhookError(admin, event.type, event.id, `Application fee refund failed: ${(e as Error).message}`, { paymentIntent });
      }

      // Update purchases with this payment intent
      const isFullRefund = charge.amount_refunded >= charge.amount;

      const { data: refundedPurchases, error: purchaseLookupErr } = await admin
        .from('purchases')
        .select('id, artist_id, release_id, buyer_email')
        .eq('stripe_pi_id', paymentIntent);

      if (purchaseLookupErr) {
        await logWebhookError(admin, event.type, event.id, `Purchase lookup failed: ${purchaseLookupErr.message}`, { paymentIntent });
      } else if (refundedPurchases && refundedPurchases.length > 0 && isFullRefund) {
        const { error: purchaseUpdateErr } = await admin
          .from('purchases')
          .update({ status: 'refunded' })
          .eq('stripe_pi_id', paymentIntent);

        if (purchaseUpdateErr) {
          await logWebhookError(admin, event.type, event.id, `Purchase refund update failed: ${purchaseUpdateErr.message}`, { paymentIntent });
        } else {
          console.log(`Marked ${refundedPurchases.length} purchase(s) as refunded for PI ${paymentIntent}`);

          // Revoke download grants for refunded purchases
          const refundedIds = refundedPurchases.map((p: any) => p.id);
          const { error: grantErr } = await admin
            .from('download_grants')
            .delete()
            .in('purchase_id', refundedIds);
          if (grantErr) {
            console.error('Failed to revoke download grants:', grantErr.message);
          } else {
            console.log(`Revoked download grants for ${refundedIds.length} refunded purchase(s)`);
          }
        }
      }

      // Update merch orders with this payment intent
      const { data: refundedOrders, error: orderLookupErr } = await admin
        .from('orders')
        .select('id, artist_id, fan_id')
        .eq('stripe_payment_intent_id', paymentIntent);

      if (orderLookupErr) {
        await logWebhookError(admin, event.type, event.id, `Order lookup failed: ${orderLookupErr.message}`, { paymentIntent });
      } else if (refundedOrders && refundedOrders.length > 0 && isFullRefund) {
        const { error: orderUpdateErr } = await admin
          .from('orders')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntent);

        if (orderUpdateErr) {
          await logWebhookError(admin, event.type, event.id, `Order refund update failed: ${orderUpdateErr.message}`, { paymentIntent });
        } else {
          console.log(`Marked ${refundedOrders.length} order(s) as refunded for PI ${paymentIntent}`);
        }
      }

      // Reverse transfers for both basket purchases AND merch orders
      // For single-release destination charges, Stripe auto-reverses via refund_application_fee.
      // For basket purchases and merch, transfers were created manually and must be reversed manually.
      const allArtistIds = new Set<string>();
      if (refundedPurchases) refundedPurchases.forEach((p: any) => { if (p.artist_id) allArtistIds.add(p.artist_id) });
      if (refundedOrders) refundedOrders.forEach((o: any) => { if (o.artist_id) allArtistIds.add(o.artist_id) });

      if (isFullRefund && allArtistIds.size > 0) {
        try {
          const { data: accounts } = await admin
            .from('artist_accounts')
            .select('id, stripe_account_id')
            .in('id', [...allArtistIds]);

          for (const account of (accounts || [])) {
            if (!account.stripe_account_id) continue;
            try {
              const transfers = await stripe.transfers.list({
                destination: account.stripe_account_id,
                limit: 100,
              });
              const matchingTransfers = transfers.data.filter(
                (t: Stripe.Transfer) => t.source_transaction === (charge as Stripe.Charge).id
              );
              for (const transfer of matchingTransfers) {
                await stripe.transfers.createReversal(transfer.id, {
                  metadata: { reason: 'refund', payment_intent: paymentIntent },
                }, { idempotencyKey: `reversal_${transfer.id}_${event.id}` });
                console.log(`Reversed transfer ${transfer.id} (${transfer.amount} ${transfer.currency}) for artist ${account.id}`);
              }
            } catch (e) {
              console.error(`Transfer reversal failed for artist ${account.id}:`, (e as Error).message);
              await logWebhookError(admin, event.type, event.id, `Transfer reversal failed: ${(e as Error).message}`, {
                artist_id: account.id,
                stripe_account_id: account.stripe_account_id,
                paymentIntent,
              });
            }
          }
        } catch (e) {
          console.error('Transfer reversal lookup failed:', (e as Error).message);
          await logWebhookError(admin, event.type, event.id, `Transfer reversal failed: ${(e as Error).message}`, { paymentIntent });
        }
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    const message = (err as Error).message;
    console.error('Handler error:', message);
    await logWebhookError(admin, event.type, event.id, message, null);
    return new Response('Internal error', { status: 500 });
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

function buildNewAccountEmail(magicLink: string, userId?: string | null): string {
  const unsubFooter = userId
    ? `<tr><td style="padding-top:32px;"><a href="${SITE_URL}/unsubscribe?user_id=${userId}" style="color:#71717A;font-size:11px;text-decoration:underline;">Unsubscribe</a></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          Your music is ready to listen.
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${magicLink}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If you didn't request this, you can ignore this email.
        </td></tr>
        ${unsubFooter}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildExistingAccountEmail(releaseTitle: string, artistName: string, userId?: string | null): string {
  const unsubFooter = userId
    ? `<tr><td style="padding-top:32px;"><a href="${SITE_URL}/unsubscribe?user_id=${userId}" style="color:#71717A;font-size:11px;text-decoration:underline;">Unsubscribe</a></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          ${escapeHtml(releaseTitle)} by ${escapeHtml(artistName)} is ready to listen.
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If you didn't request this, you can ignore this email.
        </td></tr>
        ${unsubFooter}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function upsertFlag(
  admin: ReturnType<typeof createClient>,
  userId: string,
  flagType: string,
  details: Record<string, unknown>,
) {
  const { data: existing } = await admin
    .from('suspicious_activity_flags')
    .select('id')
    .eq('user_id', userId)
    .eq('flag_type', flagType)
    .eq('reviewed', false)
    .maybeSingle()

  if (existing) {
    await admin
      .from('suspicious_activity_flags')
      .update({ details })
      .eq('id', existing.id)
    return
  }

  await admin
    .from('suspicious_activity_flags')
    .insert({ user_id: userId, flag_type: flagType, details })

  const { data: artist } = await admin
    .from('artists')
    .select('name, slug')
    .eq('id', userId)
    .maybeSingle()

  const artistName = artist?.name || 'Unknown artist'
  const adminEmails = (Deno.env.get('ADMIN_EMAILS') || '').split(',').filter(Boolean)

  const subject = `[Insound] Suspicious activity: ${flagType.replace(/_/g, ' ')}`
  const html = `<p><strong>${escapeHtml(artistName)}</strong> has been flagged for <strong>${flagType.replace(/_/g, ' ')}</strong>.</p>
<p>Details: <code>${escapeHtml(JSON.stringify(details))}</code></p>
<p><a href="${SITE_URL}/admin/flags">Review in admin portal</a></p>`

  for (const email of adminEmails) {
    await sendEmail(email.trim(), subject, html)
  }
}

function buildMerchOrderEmail(itemName: string, variant: string | null): string {
  const variantLine = variant ? ` (${escapeHtml(variant)})` : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          Your order for ${escapeHtml(itemName)}${variantLine} is confirmed. You'll be notified when it ships.
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            View your orders &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If you didn't place this order, please contact us.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function shouldNotifyInApp(admin: ReturnType<typeof createClient>, userId: string, type: string): Promise<boolean> {
  const { data: pref } = await admin
    .from('notification_preferences')
    .select('in_app')
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle();
  return !pref || pref.in_app !== false;
}

async function shouldNotifyEmail(admin: ReturnType<typeof createClient>, userId: string, type: string): Promise<boolean> {
  const { data: pref } = await admin
    .from('notification_preferences')
    .select('email')
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle();
  return !pref || pref.email !== false;
}

function buildMerchOrderArtistEmail(itemName: string, fanLabel: string, variantLine: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          You have a new order for ${escapeHtml(itemName)}${variantLine} from ${escapeHtml(fanLabel)}.
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            View order &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          Remember to dispatch this order promptly.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPurchaseReceiptEmail(releaseTitle: string, artistName: string, amountPence: number, currency = 'GBP', userId?: string | null): string {
  const amountLabel = formatPrice(amountPence, currency);
  const unsubFooter = userId
    ? `<tr><td style="padding-top:32px;"><a href="${SITE_URL}/unsubscribe?user_id=${userId}" style="color:#71717A;font-size:11px;text-decoration:underline;">Unsubscribe</a></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:20px;font-weight:700;line-height:1.4;padding-bottom:24px;">
          Thank you for your purchase!
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:16px;line-height:1.6;padding-bottom:8px;">
          ${escapeHtml(releaseTitle)} by ${escapeHtml(artistName)}
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:14px;line-height:1.6;padding-bottom:32px;">
          Amount paid: <strong style="color:#FAFAFA;">${amountLabel}</strong>
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If you have any questions about your purchase, please contact us.
        </td></tr>
        ${unsubFooter}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildBasketReceiptEmail(titles: string[], amountPence: number, currency = 'GBP', userId?: string | null): string {
  const amountLabel = formatPrice(amountPence, currency);
  const itemsList = titles.map(t => `<li style="color:#FAFAFA;font-size:14px;line-height:1.8;">${escapeHtml(t)}</li>`).join('');
  const unsubFooter = userId
    ? `<tr><td style="padding-top:32px;"><a href="${SITE_URL}/unsubscribe?user_id=${userId}" style="color:#71717A;font-size:11px;text-decoration:underline;">Unsubscribe</a></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:#F56D00;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:20px;font-weight:700;line-height:1.4;padding-bottom:24px;">
          Thank you for your purchase!
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <ul style="margin:0;padding:0 0 0 20px;">${itemsList}</ul>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:14px;line-height:1.6;padding-bottom:32px;">
          Total paid: <strong style="color:#FAFAFA;">${amountLabel}</strong>
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:13px;line-height:1.5;">
          If you have any questions about your purchase, please contact us.
        </td></tr>
        ${unsubFooter}
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
