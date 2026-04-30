/**
 * Stripe Client — Single shared instance for all server-side Stripe requests.
 *
 * WHY a single client?
 * The Stripe SDK maintains connection pooling internally. Creating one client
 * and reusing it across requests avoids redundant TLS handshakes and keeps
 * memory usage predictable. Every API call in this sample goes through this
 * client — never instantiate Stripe elsewhere.
 *
 * SETUP:
 * 1. Copy your **secret key** from https://dashboard.stripe.com/apikeys
 * 2. Add it to your environment as STRIPE_SECRET_KEY
 *    - In development: add to .env.local
 *    - In production: set via your hosting provider's env config
 * 3. The key starts with "sk_test_" (test mode) or "sk_live_" (live mode)
 */

import Stripe from 'stripe';

// ── Validate the secret key at startup ─────────────────────────────────────
// Fail fast with a clear message so developers don't chase cryptic 401 errors.
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    '[Stripe Connect Sample] Missing STRIPE_SECRET_KEY environment variable.\n' +
    'Get your secret key from https://dashboard.stripe.com/apikeys\n' +
    'Then add it to .env.local:\n' +
    '  STRIPE_SECRET_KEY=sk_test_your_key_here'
  );
}

// ── Create the Stripe client ───────────────────────────────────────────────
// The SDK automatically uses the latest API version bundled with this package
// version (v22.x uses 2026-04-22.dahlia), so we don't set apiVersion manually.
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

export default stripeClient;
