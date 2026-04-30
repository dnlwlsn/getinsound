/**
 * Products Page — Create products on the platform and assign to connected accounts.
 *
 * Products are created on YOUR platform's Stripe account (not on connected
 * accounts). Each product is mapped to a connected account so that when a
 * customer buys it, the payment is routed to the right seller.
 *
 * This is a common pattern for marketplaces:
 * - Platform controls the catalog and pricing
 * - Connected accounts are the fulfillment/payout destination
 * - Customers interact with the platform, not individual sellers
 */

'use client';

import { useState, useEffect } from 'react';

interface ConnectedAccount {
  stripeAccountId: string;
  displayName: string;
  email: string;
}

export default function ProductsPage() {
  // ── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ── Data ───────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    const res = await fetch('/api/stripe-connect-sample/accounts');
    const data = await res.json();
    setAccounts(data.accounts || []);
    if (data.accounts?.length > 0 && !selectedAccount) {
      setSelectedAccount(data.accounts[0].stripeAccountId);
    }
  }

  // ── Create a product ───────────────────────────────────────────────────
  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Convert dollars to cents (smallest currency unit).
    // Stripe always works in the smallest unit to avoid floating-point issues.
    // $9.99 → 999 cents, £15.00 → 1500 pence, etc.
    const priceInCents = Math.round(parseFloat(price) * 100);

    if (isNaN(priceInCents) || priceInCents <= 0) {
      setMessage('Please enter a valid price.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/stripe-connect-sample/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          priceInCents,
          currency,
          connectedAccountId: selectedAccount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage(`Product created! ID: ${data.productId}`);
      setName('');
      setDescription('');
      setPrice('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-8">
      <div className="max-w-2xl mx-auto space-y-8">
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
            Create Products
          </h1>
          <p className="mt-2 text-[var(--fg-muted)]">
            Products are created on your platform account and mapped to a
            connected account. When customers buy, the connected account
            receives their share of the payment.
          </p>
        </div>

        {/* ── No accounts warning ───────────────────────────────── */}
        {accounts.length === 0 && (
          <div className="p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <p className="text-sm text-yellow-400">
              No connected accounts found. Please{' '}
              <a
                href="/stripe-connect-sample/onboarding"
                className="underline hover:text-[var(--artist-accent)]"
              >
                create and onboard an account
              </a>{' '}
              first.
            </p>
          </div>
        )}

        {/* ── Create Product Form ───────────────────────────────── */}
        {accounts.length > 0 && (
          <form
            onSubmit={createProduct}
            className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] space-y-4"
          >
            <h2 className="text-lg font-display font-semibold">New Product</h2>

            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Midnight Dreams EP"
                required
                className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--artist-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A 5-track EP featuring lo-fi beats and ambient textures."
                rows={2}
                className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--artist-accent)] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--fg-muted)] mb-1">
                  Price
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="9.99"
                  step="0.01"
                  min="0.50"
                  required
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--artist-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--fg-muted)] mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] focus:outline-none focus:border-[var(--artist-accent)]"
                >
                  <option value="usd">USD ($)</option>
                  <option value="gbp">GBP (£)</option>
                  <option value="eur">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* ── Connected Account selector ─────────────────────── */}
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1">
                Connected Account (seller)
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] focus:outline-none focus:border-[var(--artist-accent)]"
              >
                {accounts.map((acc) => (
                  <option key={acc.stripeAccountId} value={acc.stripeAccountId}>
                    {acc.displayName} ({acc.stripeAccountId})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--fg-subtle)] mt-1">
                This seller will receive payments (minus platform fee) when
                customers buy this product.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-[var(--artist-accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>

            {message && (
              <p className="text-sm text-[var(--fg-muted)] font-mono">
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
