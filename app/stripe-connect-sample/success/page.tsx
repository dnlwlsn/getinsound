/**
 * Success Page — Shown after a successful Stripe Checkout payment.
 *
 * After a customer completes payment on Stripe's hosted checkout page,
 * they're redirected here with a session_id query parameter. We use this
 * to fetch the checkout session details and show a confirmation.
 *
 * IMPORTANT: In production, you should verify the payment status server-side
 * before fulfilling the order (don't trust the client redirect alone).
 * Use webhooks (checkout.session.completed) for reliable fulfillment.
 */

'use client';

import { useEffect, useState } from 'react';

export default function SuccessPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('session_id'));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-8">
      <div className="max-w-xl mx-auto space-y-8 text-center">
        {/* ── Success indicator ─────────────────────────────────── */}
        <div className="mt-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-display font-bold tracking-tight">
            Payment Successful
          </h1>

          <p className="text-[var(--fg-muted)]">
            Thank you for your purchase! The payment has been processed and
            funds will be transferred to the seller.
          </p>
        </div>

        {/* ── Session details ───────────────────────────────────── */}
        {sessionId && (
          <div className="p-4 rounded-lg bg-[var(--input-bg)] border border-[var(--line-color)]">
            <p className="text-xs text-[var(--fg-subtle)]">Checkout Session ID</p>
            <p className="text-sm font-mono text-[var(--fg-muted)] mt-1 break-all">
              {sessionId}
            </p>
          </div>
        )}

        {/* ── What happens next ─────────────────────────────────── */}
        <div className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] text-left">
          <h2 className="text-lg font-display font-semibold mb-3">
            What happens next?
          </h2>
          <ol className="space-y-2 text-sm text-[var(--fg-muted)] list-decimal list-inside">
            <li>
              Stripe processes the charge on your platform account.
            </li>
            <li>
              The platform fee (10%) is deducted and kept by the platform.
            </li>
            <li>
              The remaining amount is automatically transferred to the
              connected account (seller).
            </li>
            <li>
              The seller can view the transfer in their Express Dashboard.
            </li>
          </ol>
        </div>

        {/* ── Navigation ────────────────────────────────────────── */}
        <div className="flex justify-center gap-4">
          <a
            href="/stripe-connect-sample/storefront"
            className="px-6 py-2 rounded-lg bg-[var(--artist-accent)] text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Continue Shopping
          </a>
          <a
            href="/stripe-connect-sample"
            className="px-6 py-2 rounded-lg border border-[var(--line-color)] font-semibold hover:border-[var(--artist-accent)] transition-colors"
          >
            Back to Hub
          </a>
        </div>
      </div>
    </main>
  );
}
