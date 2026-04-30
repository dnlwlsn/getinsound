/**
 * Storefront Page — Browse all products and purchase via Stripe Checkout.
 *
 * This page demonstrates the customer-facing side of the marketplace:
 * 1. Fetches all products (with their connected account mappings)
 * 2. Fetches connected account details to show seller names
 * 3. Lets customers buy with one click (redirect to Stripe Checkout)
 *
 * PAYMENT FLOW:
 * Customer clicks "Buy" → Server creates a Checkout Session with a
 * destination charge → Customer is redirected to Stripe's hosted checkout
 * → After payment, customer lands on the success page.
 *
 * The destination charge ensures:
 * - The customer pays the full product price
 * - Stripe takes its processing fee
 * - Your platform takes its application fee (10% in this sample)
 * - The connected account (seller) receives the remainder
 */

'use client';

import { useState, useEffect } from 'react';

interface Product {
  stripeProductId: string;
  stripePriceId: string;
  connectedAccountId: string;
  name: string;
  priceInCents: number;
  currency: string;
}

interface ConnectedAccount {
  stripeAccountId: string;
  displayName: string;
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Record<string, ConnectedAccount>>({});
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);

  // ── Load products and accounts on mount ────────────────────────────────
  useEffect(() => {
    async function load() {
      const [productsRes, accountsRes] = await Promise.all([
        fetch('/api/stripe-connect-sample/products'),
        fetch('/api/stripe-connect-sample/accounts'),
      ]);

      const productsData = await productsRes.json();
      const accountsData = await accountsRes.json();

      setProducts(productsData.products || []);

      // Build a lookup map: stripeAccountId → account details
      const accountMap: Record<string, ConnectedAccount> = {};
      for (const acc of accountsData.accounts || []) {
        accountMap[acc.stripeAccountId] = acc;
      }
      setAccounts(accountMap);
    }

    load();
  }, []);

  // ── Handle purchase — redirect to Stripe Checkout ──────────────────────
  async function handleBuy(product: Product) {
    setLoadingProduct(product.stripeProductId);

    try {
      const res = await fetch('/api/stripe-connect-sample/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          priceInCents: product.priceInCents,
          currency: product.currency,
          connectedAccountId: product.connectedAccountId,
          quantity: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Redirect the customer to Stripe's hosted checkout page.
      // Stripe handles payment collection, card validation, 3D Secure,
      // and all the complex payment UI — you don't need to build any of it.
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Checkout failed:', err);
      setLoadingProduct(null);
    }
  }

  // ── Format price for display ───────────────────────────────────────────
  // Convert from smallest unit (cents) back to display format.
  function formatPrice(amountInCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountInCents / 100);
  }

  // ── Group products by connected account ────────────────────────────────
  // This creates a storefront layout where products are organized by seller,
  // making it easy to see who sells what.
  const productsByAccount: Record<string, Product[]> = {};
  for (const product of products) {
    if (!productsByAccount[product.connectedAccountId]) {
      productsByAccount[product.connectedAccountId] = [];
    }
    productsByAccount[product.connectedAccountId].push(product);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* ── Back link ─────────────────────────────────────────── */}
        <a
          href="/stripe-connect-sample"
          className="text-sm text-[var(--fg-muted)] hover:text-[var(--artist-accent)] transition-colors"
        >
          ← Back to hub
        </a>

        {/* ── Header ────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Storefront
          </h1>
          <p className="mt-2 text-[var(--fg-muted)]">
            Browse products from all connected accounts. Purchases use
            destination charges — the platform takes a 10% fee and the
            seller receives the rest.
          </p>
        </div>

        {/* ── Empty state ───────────────────────────────────────── */}
        {products.length === 0 && (
          <div className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] text-center">
            <p className="text-[var(--fg-muted)]">
              No products yet. Go to{' '}
              <a
                href="/stripe-connect-sample/products"
                className="text-[var(--artist-accent)] underline"
              >
                Create Products
              </a>{' '}
              to add some.
            </p>
          </div>
        )}

        {/* ── Products grouped by seller ─────────────────────────── */}
        {Object.entries(productsByAccount).map(([accountId, accountProducts]) => {
          const account = accounts[accountId];
          return (
            <div key={accountId} className="space-y-4">
              {/* Seller header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--artist-accent)] flex items-center justify-center text-white text-sm font-bold">
                  {(account?.displayName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display font-semibold">
                    {account?.displayName || 'Unknown Seller'}
                  </h2>
                  <p className="text-xs text-[var(--fg-subtle)] font-mono">
                    {accountId}
                  </p>
                </div>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accountProducts.map((product) => (
                  <div
                    key={product.stripeProductId}
                    className="p-5 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-2xl font-bold mt-2 text-[var(--artist-accent)]">
                        {formatPrice(product.priceInCents, product.currency)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleBuy(product)}
                      disabled={loadingProduct === product.stripeProductId}
                      className="mt-4 w-full px-4 py-2 rounded-lg bg-[var(--artist-accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loadingProduct === product.stripeProductId
                        ? 'Redirecting...'
                        : 'Buy Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── How destination charges work ───────────────────────── */}
        <div className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)]">
          <h2 className="text-lg font-display font-semibold mb-3">
            Payment Split (Destination Charge)
          </h2>
          <div className="space-y-2 text-sm text-[var(--fg-muted)]">
            <p>When a customer pays $10.00 for a product:</p>
            <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs">
              <span>Customer pays:</span>
              <span className="text-[var(--fg)]">$10.00</span>
              <span>Stripe fee (~2.9% + 30¢):</span>
              <span className="text-red-400">-$0.59</span>
              <span>Platform fee (10%):</span>
              <span className="text-[var(--artist-accent)]">-$1.00</span>
              <span className="font-semibold text-[var(--fg)]">Seller receives:</span>
              <span className="font-semibold text-green-400">$8.41</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
