/**
 * In-Memory Store — Simple data store for the sample integration.
 *
 * WHY in-memory instead of a real database?
 * This sample is designed to be self-contained and runnable without any
 * database setup. In a production app (like Insound), you'd store these
 * mappings in your database (e.g., Supabase's artist_accounts table).
 *
 * IMPORTANT: This data is lost when the server restarts. That's fine for
 * a learning sample — it means you can start fresh each time.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConnectedAccount {
  /** The Stripe account ID (e.g., "acct_1234567890") */
  stripeAccountId: string;
  /** Display name provided during account creation */
  displayName: string;
  /** Email provided during account creation */
  email: string;
  /** When this record was created */
  createdAt: string;
}

export interface ProductRecord {
  /** The Stripe product ID (e.g., "prod_ABC123") */
  stripeProductId: string;
  /** The Stripe price ID (e.g., "price_XYZ789") */
  stripePriceId: string;
  /** Which connected account owns this product */
  connectedAccountId: string;
  /** Product name */
  name: string;
  /** Price in the smallest currency unit (e.g., cents for USD) */
  priceInCents: number;
  /** ISO currency code (e.g., "usd") */
  currency: string;
}

// ── Storage ────────────────────────────────────────────────────────────────
// In production, replace these with database queries.

const accounts: ConnectedAccount[] = [];
const products: ProductRecord[] = [];

// ── Account helpers ────────────────────────────────────────────────────────

export function addAccount(account: ConnectedAccount) {
  accounts.push(account);
}

export function getAccounts(): ConnectedAccount[] {
  return [...accounts];
}

export function getAccountByStripeId(stripeAccountId: string): ConnectedAccount | undefined {
  return accounts.find((a) => a.stripeAccountId === stripeAccountId);
}

// ── Product helpers ────────────────────────────────────────────────────────

export function addProduct(product: ProductRecord) {
  products.push(product);
}

export function getProducts(): ProductRecord[] {
  return [...products];
}

export function getProductsByAccount(connectedAccountId: string): ProductRecord[] {
  return products.filter((p) => p.connectedAccountId === connectedAccountId);
}
