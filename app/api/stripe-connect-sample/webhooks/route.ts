/**
 * Webhooks API — Handle Stripe V2 "thin" events for Connect accounts.
 *
 * POST /api/stripe-connect-sample/webhooks
 *
 * WHAT ARE THIN EVENTS?
 * Stripe V2 uses "thin" events — the webhook payload contains only the
 * event ID and type (not the full object data). You then fetch the full
 * event data using the Events API. This is different from V1 webhooks
 * which include the entire object in the payload.
 *
 * WHY THIN EVENTS?
 * - Smaller payloads = faster delivery
 * - You always get fresh data (not a snapshot from when the event fired)
 * - Better security — less sensitive data in transit
 * - Required for V2 account events
 *
 * EVENTS WE HANDLE:
 *
 * 1. v2.core.account[requirements].updated
 *    Fired when an account's requirements change. This happens when:
 *    - Stripe needs additional verification documents
 *    - Regulatory requirements change
 *    - A verification deadline is approaching
 *    Action: Notify the account holder to complete updated requirements.
 *
 * 2. v2.core.account[configuration.recipient].capability_status_updated
 *    Fired when a capability's status changes (e.g., pending → active).
 *    Action: Update your UI to reflect the new capability status.
 *
 * SETUP (Stripe Dashboard):
 * 1. Go to Developers → Webhooks → + Add destination
 * 2. Events from: "Connected accounts"
 * 3. Show advanced options → Payload style: "Thin"
 * 4. Select event types:
 *    - v2.core.account[requirements].updated
 *    - v2.core.account[configuration.recipient].capability_status_updated
 * 5. Endpoint URL: https://yourdomain.com/api/stripe-connect-sample/webhooks
 *
 * LOCAL TESTING (Stripe CLI):
 * Run this command to forward events to your local server:
 *   stripe listen \
 *     --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
 *     --forward-thin-to http://localhost:3000/api/stripe-connect-sample/webhooks
 *
 * PLACEHOLDER: Set STRIPE_CONNECT_WEBHOOK_SECRET in your environment.
 * Get this from the Stripe Dashboard after creating the webhook endpoint,
 * or from the Stripe CLI output when running `stripe listen`.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';

// ── Validate the webhook secret at startup ───────────────────────────────
// This secret is used to verify that webhook requests actually come from
// Stripe and haven't been tampered with. Without it, anyone could send
// fake events to your endpoint.
if (!process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
  console.warn(
    '[Stripe Connect Sample] Missing STRIPE_CONNECT_WEBHOOK_SECRET.\n' +
    'Webhooks will fail signature verification.\n' +
    'Get your webhook secret from:\n' +
    '  - Stripe Dashboard: Developers → Webhooks → your endpoint → Signing secret\n' +
    '  - Stripe CLI: shown when you run `stripe listen`\n' +
    'Then add it to .env.local:\n' +
    '  STRIPE_CONNECT_WEBHOOK_SECRET=whsec_your_secret_here'
  );
}

export async function POST(request: NextRequest) {
  // ── Step 1: Read the raw body and signature header ─────────────────────
  // Stripe signs every webhook with a signature header. We need the RAW
  // body (not parsed JSON) to verify this signature.
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured. See server logs.' },
      { status: 500 }
    );
  }

  try {
    // ── Step 2: Parse and verify the thin event ──────────────────────────
    // parseThinEvent does two things:
    // 1. Verifies the signature (ensures the event really came from Stripe)
    // 2. Parses the payload into a typed thin event object
    //
    // If the signature is invalid (tampered payload, wrong secret, replay
    // attack), this throws an error and we return 400.
    const thinEvent = stripeClient.parseThinEvent(body, signature, webhookSecret);

    // ── Step 3: Fetch the full event data ────────────────────────────────
    // The thin event only has the event ID and type. To get the actual
    // data (account details, requirement changes, etc.), we fetch the
    // full event from the Events API.
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id);

    // ── Step 4: Handle each event type ───────────────────────────────────
    switch (event.type) {
      case 'v2.core.account[requirements].updated': {
        // Requirements changed — the account holder may need to provide
        // additional information (documents, identity verification, etc.)
        //
        // In production, you would:
        // 1. Look up the user in your database by their Stripe account ID
        // 2. Send them an email or in-app notification
        // 3. Generate a new account link so they can update their info
        // 4. Optionally restrict their access until requirements are met
        console.log(
          `[Webhook] Requirements updated for account: ${JSON.stringify(event.related_object)}`,
          `\n  Event ID: ${event.id}`,
          `\n  Action: Notify account holder to complete updated requirements.`
        );
        break;
      }

      case 'v2.core.account[configuration.recipient].capability_status_updated': {
        // A capability's status changed. Common transitions:
        //   inactive → pending (submitted for review)
        //   pending → active (approved — can receive payments!)
        //   active → inactive (something went wrong — needs attention)
        //
        // In production, you would:
        // 1. Update the account status in your database
        // 2. If newly active: enable the seller's storefront
        // 3. If deactivated: pause their listings and notify them
        console.log(
          `[Webhook] Capability status updated for account: ${JSON.stringify(event.related_object)}`,
          `\n  Event ID: ${event.id}`,
          `\n  Action: Update account status in database.`
        );
        break;
      }

      default: {
        // Log unhandled event types — useful during development to see
        // what events you're receiving and whether you need to handle them.
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }
    }

    // ── Step 5: Acknowledge receipt ──────────────────────────────────────
    // IMPORTANT: Always return 200 quickly. If you return an error or take
    // too long, Stripe will retry the event (up to 3 days with exponential
    // backoff). This can cause duplicate processing if you're not careful.
    //
    // For long-running tasks (sending emails, updating databases), consider
    // putting the event on a queue and processing it asynchronously.
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Webhook processing failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Return 400 for signature verification failures so Stripe knows
    // the event wasn't processed and should be retried.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
