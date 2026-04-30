/**
 * Products API — Create and list products at the platform level.
 *
 * POST /api/stripe-connect-sample/products
 *   Creates a Stripe Product (with a default Price) on the PLATFORM account.
 *
 * GET /api/stripe-connect-sample/products
 *   Lists all products from our local store (with connected account mapping).
 *
 * WHY PLATFORM-LEVEL PRODUCTS?
 * Products are created on your platform's Stripe account (not on connected
 * accounts). This means:
 * - You control the product catalog centrally
 * - You set the pricing
 * - Connected accounts just receive their share of each payment
 * - One product can theoretically be sold by multiple connected accounts
 *
 * The mapping between product and connected account is stored in our local
 * store (in production, this would be your database). We also store the
 * connected account ID in the product's metadata on Stripe, which is useful
 * for reconciliation and debugging in the Stripe Dashboard.
 *
 * PRICING:
 * We use `default_price_data` to create a Price object at the same time as
 * the Product. This is convenient for one-time purchases. For subscriptions
 * or complex pricing (tiers, volume, etc.), you'd create Prices separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/app/stripe-connect-sample/lib/stripe';
import { addProduct, getProducts } from '@/app/stripe-connect-sample/lib/store';

// ── POST: Create a product ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, priceInCents, currency, connectedAccountId } = body;

    // Validate all required fields
    if (!name || !priceInCents || !currency || !connectedAccountId) {
      return NextResponse.json(
        { error: 'name, priceInCents, currency, and connectedAccountId are required.' },
        { status: 400 }
      );
    }

    // ── Create the product on the PLATFORM account ───────────────────────
    // Notice we call stripeClient.products.create() — NOT on a connected
    // account. The product lives on YOUR Stripe account.
    //
    // default_price_data creates a Price object automatically:
    // - unit_amount: price in the smallest currency unit (cents for USD)
    // - currency: ISO 4217 currency code (lowercase)
    //
    // metadata: We store the connected account ID here so we can find it
    // later when looking at products in the Stripe Dashboard. This is a
    // convenience — our local store is the primary mapping.
    const product = await stripeClient.products.create({
      name,
      description: description || undefined,
      default_price_data: {
        unit_amount: priceInCents,
        currency,
      },
      metadata: {
        connected_account_id: connectedAccountId,
      },
    });

    // ── Store the mapping locally ────────────────────────────────────────
    // In production, insert a row into your products/releases table with
    // the Stripe product ID, price ID, and the artist/account it belongs to.
    //
    // default_price is the Price ID that was auto-created. We need this
    // for creating checkout sessions later.
    const priceId =
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id ?? '';

    addProduct({
      stripeProductId: product.id,
      stripePriceId: priceId,
      connectedAccountId,
      name,
      priceInCents,
      currency,
    });

    return NextResponse.json({
      productId: product.id,
      priceId,
      message: 'Product created successfully.',
    });
  } catch (error: unknown) {
    console.error('[Stripe Connect] Product creation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET: List all products ───────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ products: getProducts() });
}
