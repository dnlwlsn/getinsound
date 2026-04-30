/**
 * Account Status API — Check onboarding and capability status of a connected account.
 *
 * GET /api/stripe-connect-sample/account-status?accountId=acct_xxx
 *
 * WHAT THIS DOES:
 * Retrieves the current state of a connected account directly from Stripe.
 * We intentionally do NOT cache this in a database — the status can change
 * at any time (e.g., Stripe may request additional verification), so we
 * always fetch fresh data from the API.
 *
 * KEY STATUS FIELDS:
 *
 * 1. readyToReceivePayments (boolean):
 *    Whether the account's stripe_transfers capability is "active".
 *    When true, you can send money to this account via destination charges.
 *
 * 2. onboardingComplete (boolean):
 *    Whether all currently required information has been provided.
 *    Stripe tracks requirements in a "summary" with deadline statuses:
 *    - "currently_due" = info needed now, account may be restricted
 *    - "past_due" = deadline passed, account IS restricted
 *    - Neither = onboarding is complete (for now)
 *
 *    NOTE: Requirements can change later! Stripe may request additional
 *    info due to regulatory changes, suspicious activity, or annual
 *    verification. That's why we listen for webhook events (see webhooks route).
 *
 * 3. requirementsStatus (string | null):
 *    The raw status from Stripe's requirements summary. Useful for showing
 *    granular status in your UI.
 *
 * V2 API NOTES:
 * - Uses stripeClient.v2.core.accounts.retrieve()
 * - The `include` parameter fetches nested objects that aren't returned by
 *   default, reducing payload size for calls that don't need them.
 * - We include "configuration.recipient" to check capability status
 *   and "requirements" to check onboarding completeness.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json(
      { error: 'accountId query parameter is required.' },
      { status: 400 }
    );
  }

  try {
    // ── Retrieve the account with expanded fields ────────────────────────
    // The `include` array tells the V2 API which nested objects to return.
    // Without this, configuration and requirements would be omitted from
    // the response to keep payloads small.
    const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.recipient', 'requirements'],
    });

    // ── Check if the account can receive payments ────────────────────────
    // This drills into the recipient configuration to check whether the
    // stripe_transfers capability is active. The path mirrors what we
    // requested during account creation:
    //   configuration.recipient.capabilities.stripe_balance.stripe_transfers
    const readyToReceivePayments =
      account?.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === 'active';

    // ── Check onboarding completeness ────────────────────────────────────
    // The requirements summary tells us if Stripe needs anything from
    // the account holder. The minimum_deadline is the most urgent deadline.
    const requirementsStatus =
      account.requirements?.summary?.minimum_deadline?.status ?? null;

    // If status is "currently_due" or "past_due", onboarding is incomplete.
    // Any other value (null, "eventually_due", etc.) means they're good for now.
    const onboardingComplete =
      requirementsStatus !== 'currently_due' &&
      requirementsStatus !== 'past_due';

    return NextResponse.json({
      accountId: account.id,
      displayName: account.display_name,
      readyToReceivePayments,
      onboardingComplete,
      requirementsStatus,
    });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Account status check failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
