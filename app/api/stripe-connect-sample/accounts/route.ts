/**
 * Connected Accounts API — Create and list Stripe Connect accounts.
 *
 * POST /api/stripe-connect-sample/accounts
 *   Creates a new connected account using the V2 Accounts API.
 *   The platform (your app) is responsible for fee and loss collection.
 *
 * GET /api/stripe-connect-sample/accounts
 *   Lists all connected accounts stored in our local mapping.
 *
 * KEY CONCEPTS:
 * - "Connected account" = a user on your platform who receives payments
 * - "Platform" = your application (Insound), which facilitates payments
 * - "Express dashboard" = Stripe-hosted dashboard for connected accounts
 *   (less work for you — Stripe handles the UI for payouts, tax forms, etc.)
 *
 * V2 API NOTES:
 * - The V2 accounts API is accessed via stripeClient.v2.core.accounts
 * - Do NOT pass a top-level `type` field (no type: 'express', 'standard', etc.)
 * - Instead, use `dashboard: 'express'` to control the dashboard experience
 * - Responsibilities (fees_collector, losses_collector) define who handles what
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';
import { addAccount, getAccounts } from '@/app/stripe-connect-sample/lib/store';

// ── POST: Create a connected account ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName, email } = body;

    // Validate inputs — in production, also validate email format, sanitize, etc.
    if (!displayName || !email) {
      return NextResponse.json(
        { error: 'Both displayName and email are required.' },
        { status: 400 }
      );
    }

    // ── Create the connected account via V2 API ──────────────────────────
    // Key properties explained:
    //
    // display_name / contact_email:
    //   Basic identity info for the account. Shows in Stripe Dashboard.
    //
    // identity.country:
    //   The country where this account holder is based. Determines which
    //   regulations, payment methods, and payout schedules apply.
    //
    // dashboard: 'express':
    //   Gives the connected account access to a Stripe-hosted dashboard
    //   where they can see payouts, download tax forms, etc. Less work
    //   for you compared to building a custom dashboard.
    //
    // defaults.responsibilities:
    //   fees_collector: 'application' — YOUR platform collects fees from
    //     customers and pays them out, minus your platform fee.
    //   losses_collector: 'application' — YOUR platform is responsible for
    //     disputes, refunds, and negative balances. This gives you more
    //     control but also more liability.
    //
    // configuration.recipient:
    //   Sets up this account to RECEIVE money (via Stripe transfers).
    //   The capability stripe_balance.stripe_transfers lets your platform
    //   send funds to this account after a successful charge.
    //
    const account = await stripeClient.v2.core.accounts.create({
      display_name: displayName,
      contact_email: email,
      identity: {
        country: 'us',
      },
      dashboard: 'express',
      defaults: {
        responsibilities: {
          fees_collector: 'application',
          losses_collector: 'application',
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    });

    // ── Store the mapping locally ────────────────────────────────────────
    // In production, save this to your database. You need to map your
    // internal user/artist ID to the Stripe account ID so you can:
    // 1. Route payments to the right account
    // 2. Check onboarding status
    // 3. Create account links for returning users
    addAccount({
      stripeAccountId: account.id,
      displayName,
      email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      accountId: account.id,
      message: 'Connected account created. Next step: onboard the account.',
    });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Account creation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET: List all connected accounts ──────────────────────────────────────
export async function GET() {
  return NextResponse.json({ accounts: getAccounts() });
}
