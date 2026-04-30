/**
 * Onboarding Page — Create connected accounts and manage their onboarding.
 *
 * This page demonstrates the full onboarding flow:
 * 1. Create a connected account (V2 API)
 * 2. Generate an account link for Stripe's hosted onboarding
 * 3. Check the account's status after they return
 *
 * The account status is always fetched live from Stripe's API (never cached
 * in a database), so it always reflects the current state.
 */

'use client';

import { useState, useEffect } from 'react';

// ── Types for our API responses ──────────────────────────────────────────
interface AccountStatus {
  accountId: string;
  displayName: string;
  readyToReceivePayments: boolean;
  onboardingComplete: boolean;
  requirementsStatus: string | null;
}

interface ConnectedAccount {
  stripeAccountId: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export default function OnboardingPage() {
  // ── Form state ─────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ── Account list and status ────────────────────────────────────────────
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AccountStatus>>({});
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});

  // ── Check if we're returning from Stripe onboarding ────────────────────
  // When Stripe redirects back, the URL contains ?accountId=acct_xxx
  // We use this to automatically refresh that account's status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returningAccountId = params.get('accountId');
    if (returningAccountId) {
      fetchAccountStatus(returningAccountId);
    }
    fetchAccounts();
  }, []);

  // ── Fetch all accounts from our local store ────────────────────────────
  async function fetchAccounts() {
    const res = await fetch('/api/stripe-connect-sample/accounts');
    const data = await res.json();
    setAccounts(data.accounts || []);
  }

  // ── Create a new connected account ─────────────────────────────────────
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/stripe-connect-sample/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage(`Account created: ${data.accountId}`);
      setDisplayName('');
      setEmail('');
      fetchAccounts();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch account status from Stripe (always live, never cached) ──────
  async function fetchAccountStatus(accountId: string) {
    setStatusLoading((prev) => ({ ...prev, [accountId]: true }));

    try {
      const res = await fetch(
        `/api/stripe-connect-sample/account-status?accountId=${accountId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatuses((prev) => ({ ...prev, [accountId]: data }));
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setStatusLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  }

  // ── Start the Stripe-hosted onboarding flow ────────────────────────────
  // This creates an account link and redirects the user to Stripe's
  // onboarding page. After completing (or exiting), they'll be sent
  // back to this page with ?accountId=xxx in the URL.
  async function startOnboarding(accountId: string) {
    try {
      const res = await fetch('/api/stripe-connect-sample/account-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Redirect to Stripe's hosted onboarding page
      window.location.href = data.url;
    } catch (err) {
      console.error('Failed to create account link:', err);
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
            Onboard Connected Accounts
          </h1>
          <p className="mt-2 text-[var(--fg-muted)]">
            Create a connected account, then guide them through Stripe&apos;s hosted
            onboarding flow. Status is always fetched live from Stripe.
          </p>
        </div>

        {/* ── Create Account Form ───────────────────────────────── */}
        <form
          onSubmit={createAccount}
          className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] space-y-4"
        >
          <h2 className="text-lg font-display font-semibold">
            Create Connected Account
          </h2>

          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Jane's Music Shop"
              required
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--artist-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line-color)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--artist-accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-[var(--artist-accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>

          {message && (
            <p className="text-sm text-[var(--fg-muted)] font-mono">{message}</p>
          )}
        </form>

        {/* ── Account List ──────────────────────────────────────── */}
        {accounts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-semibold">
              Connected Accounts
            </h2>

            {accounts.map((account) => {
              const status = statuses[account.stripeAccountId];
              const isLoading = statusLoading[account.stripeAccountId];

              return (
                <div
                  key={account.stripeAccountId}
                  className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] space-y-3"
                >
                  {/* Account header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{account.displayName}</h3>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {account.email}
                      </p>
                      <p className="text-xs text-[var(--fg-subtle)] font-mono mt-1">
                        {account.stripeAccountId}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => startOnboarding(account.stripeAccountId)}
                      className="px-4 py-2 rounded-lg bg-[var(--artist-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Onboard to collect payments
                    </button>
                    <button
                      onClick={() => fetchAccountStatus(account.stripeAccountId)}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg border border-[var(--line-color)] text-sm font-semibold hover:border-[var(--artist-accent)] transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Checking...' : 'Check Status'}
                    </button>
                  </div>

                  {/* Status display (only shown after clicking "Check Status") */}
                  {status && (
                    <div className="p-4 rounded-lg bg-[var(--bg)] space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            status.readyToReceivePayments
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        <span>
                          Payments:{' '}
                          {status.readyToReceivePayments
                            ? 'Ready to receive'
                            : 'Not yet active'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            status.onboardingComplete
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        <span>
                          Onboarding:{' '}
                          {status.onboardingComplete ? 'Complete' : 'Incomplete'}
                        </span>
                      </div>
                      {status.requirementsStatus && (
                        <p className="text-[var(--fg-subtle)] font-mono text-xs">
                          Requirements status: {status.requirementsStatus}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
