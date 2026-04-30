/**
 * Checkout API — Create a Stripe Checkout session with a destination charge.
 *
 * POST /api/stripe-connect-sample/checkout
 *
 * WHAT IS A DESTINATION CHARGE?
 * A "destination charge" is one of three Connect charge models:
 *
 * 1. Direct charges — charge is created ON the connected account
 * 2. Destination charges — charge is created on YOUR platform, then
 *    Stripe automatically transfers a portion to the connected account ← WE USE THIS
 * 3. Separate charges and transfers — you charge and transfer manually
 *
 * WHY DESTINATION CHARGES?
 * - Simplest model for platforms that control pricing
 * - The charge appears on YOUR platform's Stripe Dashboard
 * - You can take a platform fee (application_fee_amount)
 * - Stripe automatically handles the transfer to the connected account
 * - The customer sees YOUR platform name on their credit card statement
 *
 * HOW IT WORKS:
 * 1. Customer clicks "Buy" on your storefront
 * 2. Your server creates a Checkout Session with transfer_data.destination
 * 3. Customer is redirected to Stripe's hosted checkout page
 * 4. After payment, Stripe:
 *    a. Charges the customer
 *    b. Takes Stripe's processing fee
 *    c. Takes your platform fee (application_fee_amount)
 *    d. Transfers the remainder to the connected account
 * 5. Customer is redirected to your success_url
 *
 * HOSTED CHECKOUT:
 * We use Stripe's hosted checkout page (mode: 'payment') instead of
 * building a custom payment form. Benefits:
 * - PCI compliance handled by Stripe
 * - Supports 40+ payment methods automatically
 * - Built-in fraud protection
 * - Mobile-optimized UI
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, priceInCents, currency, connectedAccountId, quantity } = body;

    if (!productName || !priceInCents || !currency || !connectedAccountId) {
      return NextResponse.json(
        { error: 'productName, priceInCents, currency, and connectedAccountId are required.' },
        { status: 400 }
      );
    }

    // ── Determine the base URL for redirects ─────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const sampleBase = `${baseUrl}/stripe-connect-sample`;

    // ── Calculate platform fee ───────────────────────────────────────────
    // PLACEHOLDER: Set your platform fee here.
    // This example takes 10% of the sale price. Adjust to your business model.
    // The fee is in the smallest currency unit (cents for USD).
    const platformFeePercent = 10;
    const itemTotal = priceInCents * (quantity || 1);
    const applicationFee = Math.round(itemTotal * (platformFeePercent / 100));

    // ── Create the Checkout Session ──────────────────────────────────────
    //
    // line_items: What the customer is buying. We use price_data for
    //   inline pricing (vs. referencing a saved Price ID). Both work.
    //
    // payment_intent_data.transfer_data.destination:
    //   THIS IS THE KEY PART. It tells Stripe to automatically transfer
    //   funds to the connected account after the payment succeeds.
    //
    // payment_intent_data.application_fee_amount:
    //   Your platform's cut of the transaction. Stripe subtracts this
    //   before transferring to the connected account.
    //
    // mode: 'payment':
    //   One-time payment (vs. 'subscription' for recurring charges).
    //
    // success_url:
    //   Where to send the customer after successful payment.
    //   {CHECKOUT_SESSION_ID} is a Stripe template variable that gets
    //   replaced with the actual session ID — useful for showing a
    //   confirmation page with order details.
    //
    // cancel_url:
    //   Where to send the customer if they click "Back" on checkout.
    //
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: productName,
            },
            unit_amount: priceInCents,
          },
          quantity: quantity || 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: connectedAccountId,
        },
      },
      mode: 'payment',
      success_url: `${sampleBase}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${sampleBase}/storefront`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Checkout session creation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
