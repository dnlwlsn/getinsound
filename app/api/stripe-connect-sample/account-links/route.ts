/**
 * Account Links API — Generate onboarding URLs for connected accounts.
 *
 * POST /api/stripe-connect-sample/account-links
 *
 * WHAT THIS DOES:
 * When a connected account needs to complete onboarding (provide identity
 * verification, bank details, tax info, etc.), you generate an "account link"
 * — a short-lived URL that takes them to Stripe's hosted onboarding flow.
 *
 * WHY ACCOUNT LINKS?
 * - Stripe handles all the complex identity verification UI
 * - You don't need to collect or store sensitive documents
 * - The flow adapts automatically to the account's country and requirements
 * - Links expire quickly for security (typically a few minutes)
 *
 * FLOW:
 * 1. Your UI calls this endpoint with the account ID
 * 2. We create an account link via Stripe's V2 API
 * 3. We return the URL to the frontend
 * 4. The frontend redirects the user to that URL
 * 5. After completing onboarding, Stripe redirects back to your return_url
 * 6. If the link expires or the user needs to restart, Stripe hits refresh_url
 *
 * V2 API NOTES:
 * - Uses stripeClient.v2.core.accountLinks.create()
 * - The use_case object specifies this is for account_onboarding
 * - configurations: ['recipient'] matches the configuration we set during
 *   account creation — it tells Stripe which capabilities to collect info for
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required.' },
        { status: 400 }
      );
    }

    // ── Determine the base URL for redirects ─────────────────────────────
    // PLACEHOLDER: In production, use your actual domain.
    // In development, this will be http://localhost:3000
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const sampleBase = `${baseUrl}/stripe-connect-sample`;

    // ── Create the account link via V2 API ───────────────────────────────
    //
    // refresh_url: Where Stripe sends the user if the link expires or they
    //   need to restart. You should regenerate a new account link here.
    //   Typically points back to your onboarding page.
    //
    // return_url: Where Stripe sends the user after they complete (or exit)
    //   onboarding. We include the accountId as a query param so the
    //   return page can check the account's status.
    //
    // configurations: ['recipient'] — Must match the configuration type
    //   you used when creating the account. This tells Stripe which set
    //   of requirements to collect information for.
    //
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: `${sampleBase}/onboarding`,
          return_url: `${sampleBase}/onboarding?accountId=${accountId}`,
        },
      },
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Account link creation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
