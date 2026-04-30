/**
 * Stripe Connect Sample — Hub Page
 *
 * This is the entry point for the sample integration. It links to the three
 * main flows: onboarding, product management, and the storefront.
 *
 * In a real application, these flows would be integrated into your existing
 * pages (e.g., onboarding in your artist dashboard, storefront on artist
 * profile pages). They're separated here for clarity.
 */

export default function StripeConnectSampleHub() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Stripe Connect Sample
          </h1>
          <p className="mt-2 text-[var(--fg-muted)]">
            A complete walkthrough of Stripe Connect: onboarding sellers,
            creating products, and processing payments with destination charges.
          </p>
        </div>

        {/* ── Flow links ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Step 1: Onboarding */}
          <a
            href="/stripe-connect-sample/onboarding"
            className="block p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] hover:border-[var(--artist-accent)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--artist-accent)] text-white text-sm font-bold">
                1
              </span>
              <h2 className="text-lg font-display font-semibold">
                Onboard Connected Accounts
              </h2>
            </div>
            <p className="mt-2 ml-11 text-sm text-[var(--fg-muted)]">
              Create a connected account and guide them through Stripe&apos;s
              hosted onboarding flow to collect identity, bank, and tax info.
            </p>
          </a>

          {/* Step 2: Products */}
          <a
            href="/stripe-connect-sample/products"
            className="block p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] hover:border-[var(--artist-accent)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--artist-accent)] text-white text-sm font-bold">
                2
              </span>
              <h2 className="text-lg font-display font-semibold">
                Create Products
              </h2>
            </div>
            <p className="mt-2 ml-11 text-sm text-[var(--fg-muted)]">
              Add products to your platform catalog. Products are created on
              your platform account and mapped to connected accounts.
            </p>
          </a>

          {/* Step 3: Storefront */}
          <a
            href="/stripe-connect-sample/storefront"
            className="block p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)] hover:border-[var(--artist-accent)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--artist-accent)] text-white text-sm font-bold">
                3
              </span>
              <h2 className="text-lg font-display font-semibold">
                Storefront &amp; Checkout
              </h2>
            </div>
            <p className="mt-2 ml-11 text-sm text-[var(--fg-muted)]">
              Browse all products, buy with Stripe Checkout, and see how
              destination charges split payments between platform and seller.
            </p>
          </a>
        </div>

        {/* ── Architecture overview ───────────────────────────────── */}
        <div className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)]">
          <h2 className="text-lg font-display font-semibold mb-3">
            How It Works
          </h2>
          <div className="space-y-3 text-sm text-[var(--fg-muted)]">
            <p>
              <strong className="text-[var(--fg)]">Platform</strong> (your app)
              creates connected accounts, manages products, and initiates charges.
            </p>
            <p>
              <strong className="text-[var(--fg)]">Connected Accounts</strong>{' '}
              (sellers/artists) complete onboarding and receive their share of payments.
            </p>
            <p>
              <strong className="text-[var(--fg)]">Customers</strong> buy products
              through Stripe&apos;s hosted checkout. The platform takes a fee,
              and the rest goes to the connected account.
            </p>
          </div>
        </div>

        {/* ── Environment checklist ───────────────────────────────── */}
        <div className="p-6 rounded-xl border border-[var(--line-color)] bg-[var(--input-bg)]">
          <h2 className="text-lg font-display font-semibold mb-3">
            Environment Setup
          </h2>
          <div className="space-y-2 text-sm font-mono text-[var(--fg-muted)]">
            <p>
              <span className="text-[var(--artist-accent)]">STRIPE_SECRET_KEY</span>
              =sk_test_...
            </p>
            <p>
              <span className="text-[var(--artist-accent)]">STRIPE_CONNECT_WEBHOOK_SECRET</span>
              =whsec_... <span className="text-[var(--fg-subtle)]">(for webhooks)</span>
            </p>
            <p>
              <span className="text-[var(--artist-accent)]">NEXT_PUBLIC_SITE_URL</span>
              =http://localhost:3000 <span className="text-[var(--fg-subtle)]">(for redirects)</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
