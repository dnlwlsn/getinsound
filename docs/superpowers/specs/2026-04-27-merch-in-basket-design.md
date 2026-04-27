# Merch in Basket — Design Spec

## Overview

Add merch support to the existing basket system so fans can buy music and merch together in a single checkout. Fees are calculated per-item: music from founding artists gets zero platform fees for the first year, merch always pays 10%. Postage is per-item. The basket UI shows a fully transparent breakdown.

## Data Model

### BasketItem (client store)

Discriminated union on `type`:

```ts
interface BaseItem {
  artistId: string
  artistName: string
  artistSlug: string
  pricePence: number
  currency: string
  accentColour: string | null
}

interface ReleaseBasketItem extends BaseItem {
  type: 'release'
  releaseId: string
  releaseTitle: string
  releaseSlug: string
  coverUrl: string | null
  customAmountPence?: number
}

interface MerchBasketItem extends BaseItem {
  type: 'merch'
  merchId: string
  merchName: string
  variant: string | null
  postagePence: number
  photoUrl: string | null
}

type BasketItem = ReleaseBasketItem | MerchBasketItem
```

Dedupe key: `releaseId` for releases, `merchId + variant` for merch.

### BasketRequestItem (edge function input)

```ts
type BasketRequestItem =
  | { type: 'release'; release_id: string; custom_amount?: number }
  | { type: 'merch'; merch_id: string; variant?: string }
```

### basket_sessions.items (DB)

Already JSONB. Stores the enriched item array with `type` discriminator. No schema migration needed — the column accepts any valid JSON.

## Basket Store (`lib/stores/basket.ts`)

- `add()`: dedupes on `releaseId` (releases) or `merchId + variant` (merch)
- `remove()`: keyed same way — accepts an item identity, not just releaseId
- `has()`: keyed same way
- `total()`: sum of all item prices + merch postage
- New `postageTotal()`: sum of all merch `postagePence` values (for display)
- New `itemsTotal()`: sum of all item prices without postage (for display)

## Basket Drawer (`BasketDrawer.tsx`)

### Review stage

Items grouped by artist (existing pattern). Within each group:
- Release items: album art, title, price (existing rendering)
- Merch items: photo, name, variant label (if any), price. Postage shown per-item as a secondary line.

Summary section below items:
- Subtotal (items only)
- P&P (total postage, only shown if > 0)
- Total (grand total)

If basket contains merch: show "Shipping address collected at checkout" note above the checkout button.

### Post-checkout stages

After Stripe payment completes:

1. **Music-only basket**: existing flow unchanged (consent → downloads)
2. **Merch-only basket**: skip consent/download, show order confirmation ("Your order is confirmed. You'll be notified when it ships.")
3. **Mixed basket**: split screen:
   - Music section: consent checkbox → download links
   - Orders section: confirmation cards per merch item with name, variant, "You'll be notified when it ships"

The `pollForDownloads` function is called for baskets containing music. For merch-only baskets, skip polling and go straight to the order confirmation stage.

## Merch Detail Page (`MerchItemClient.tsx`)

Add "Add to basket" button alongside existing "Buy now":
- Only enabled when variant is selected (if variants exist) and in stock
- Constructs a `MerchBasketItem` and calls `useBasketStore().add()`
- Shows "In basket" state when already added (same merchId + variant)

## Checkout Function (`checkout-basket-create`)

### Input handling

Accept items with `type` field. Items without `type` treated as `'release'` for backwards compat with any in-flight baskets.

### Data fetching

- Separate items by type
- Fetch releases from `releases` table (existing)
- Fetch merch from `merch` table: `id, name, price, currency, postage, stock, variants, is_active, photos, artist_id, artists!inner(id, slug, name)`
- Validate merch: active, in stock, valid variant if specified

### Account resolution

Collect all artist IDs from both releases and merch. Fetch stripe accounts for all (existing pattern). Fail if any artist isn't onboarded.

### Zero-fees

Only applied to `type: 'release'` items. Merch items always pay `PLATFORM_FEE_BPS`.

### Line items

For each release: existing price_data line item.
For each merch item: price_data line item with merch name (+ variant if any), photo.
For each merch item with postage > 0: separate "Postage" line item.

### Shipping

If any merch items present: include `shipping_address_collection` with the same country list as `checkout-merch-create`.

### Application fee

Sum of:
- Release items: `Math.round((unitAmount * PLATFORM_FEE_BPS) / 10000)`, zeroed if artist has zero-fees
- Merch items: `Math.round((merchPrice * PLATFORM_FEE_BPS) / 10000)` — always charged, postage excluded from fee calc

### basket_sessions row

Items array includes `type` field per item:
- Release items: `{ type: 'release', release_id, artist_id, amount_pence, stripe_account_id }`
- Merch items: `{ type: 'merch', merch_id, artist_id, amount_pence, postage_pence, variant, stripe_account_id }`

## Webhook (`stripe-webhook`)

### Basket handler changes

Read `type` from each item in the basket session. Process in the existing loop:

**For `type: 'release'` items** (existing, unchanged):
- Insert purchase, issue download grant, notify artist, set zero-fees start

**For `type: 'merch'` items** (ported from standalone merch handler):
- Atomic stock decrement via `decrement_merch_stock` RPC
- If stock was 0: refund proportional amount, notify fan, skip order insert
- Insert order: fan_id, artist_id, merch_id, variant, amounts, shipping address, status='pending'
- Notify artist (in-app + email, respecting preferences)
- Notify fan (in-app)

Transfers: existing per-item transfer logic, per type:
- Release: `artistPence = amount - platformFee` (existing)
- Merch: `artistPence = merchPrice + postagePence - platformFee` (postage passes through to the artist since they handle shipping; platform fee is on merchPrice only, not postage — matching standalone merch behavior)

Email: receipt lists both music titles and merch items.

## Unchanged

- `checkout-create` (single release purchase)
- `checkout-merch-create` (standalone "Buy now" on merch detail page)
- `MerchCard` component (links to detail page)
- Artist profile merch grid
- Migration: no new tables or columns needed
