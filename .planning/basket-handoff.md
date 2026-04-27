# Basket Feature — Handoff

## What's Done (Favourites)
All favourites work from the previous pass is complete and compiles clean:
- `supabase/migrations/0034_favourites.sql` — table, RLS, aggregate views
- `lib/stores/favourites.ts` — Zustand store
- `app/api/favourites/route.ts` — GET/POST/DELETE
- `app/api/favourites/counts/route.ts` — artist aggregate counts
- `app/components/ui/FavouriteButton.tsx` — heart toggle with signed-out prompt
- FavouriteButton wired into: ArtistProfileClient, DiscoverClient, SearchClient, PlayerBar
- Dashboard shows save counts per release
- Library has "Saved" tab
- **Migration SQL needs to be run against Supabase** (Dan has it on clipboard)

## What To Build: Basket + Multi-Artist Checkout

### Architecture Change
**Current:** Stripe Connect destination charges — one artist per Checkout Session via `payment_intent_data.transfer_data.destination`.

**New:** Separate charges + transfers. Platform collects full amount in a single Checkout Session (no `transfer_data`). After `checkout.session.completed`, webhook creates `stripe.transfers.create()` per artist using `source_transaction` to link to the charge.

Single-item "Buy now" flow stays as-is (destination charges). Basket uses the new pattern.

### Files To Create

1. **`lib/stores/basket.ts`** — Zustand store
   ```ts
   interface BasketItem {
     releaseId: string
     releaseTitle: string
     artistId: string
     artistName: string
     artistSlug: string
     coverUrl: string | null
     pricePence: number
     currency: string
     customAmountPence?: number // for PWYW
     accentColour: string | null
   }
   interface BasketState {
     items: BasketItem[]
     add: (item: BasketItem) => void
     remove: (releaseId: string) => void
     clear: () => void
     has: (releaseId: string) => boolean
     total: () => number // sum of pricePence/customAmountPence
   }
   ```
   - Persist to localStorage so basket survives page refreshes
   - Max ~20 items (sensible limit)

2. **`app/components/ui/BasketDrawer.tsx`** — slide-out drawer
   - Items grouped by artist
   - Each item: cover, title, artist, price, remove button
   - Total at bottom
   - "Checkout" button → calls checkout-basket-create
   - Same Stripe Embedded Checkout pattern as ReleaseClient
   - After payment: poll for download grants, show consent, show downloads

3. **`app/components/ui/BasketButton.tsx`** — nav icon with count badge
   - Shopping bag/cart icon
   - Badge showing item count
   - Opens BasketDrawer on click

4. **`app/components/ui/AddToBasketButton.tsx`** — for artist pages, search, release page
   - Small button: "Add to basket" or cart icon
   - If already in basket: "In basket" (disabled/different style)
   - Signed-out users: show sign-in prompt (same as FavouriteButton)

5. **`supabase/functions/checkout-basket-create/index.ts`** — new edge function
   ```ts
   // Takes: { items: [{ release_id, custom_amount? }], fan_currency, origin }
   // For each item: validate release exists, published, artist has stripe
   // Build line_items array (one per release)
   // NO transfer_data on payment_intent_data
   // Metadata: type='basket', items=JSON([{release_id, artist_id, amount_pence, stripe_account_id}])
   // Returns: { client_secret, session_id }
   
   // Key difference from checkout-create:
   // - No transfer_data.destination
   // - application_fee_amount = sum of all platform fees
   // - metadata.type = 'basket'
   // - metadata.items = JSON array of items with artist info
   ```
   
   **IMPORTANT:** Stripe metadata values max 500 chars. If basket has many items, may need to store basket details in Supabase (e.g., `basket_sessions` table) and just put the basket_id in metadata.

6. **Update `supabase/functions/stripe-webhook/index.ts`**
   - After line 46 (`if (sessionType === 'merch') {`), add a new block:
   ```ts
   if (sessionType === 'basket') {
     // Parse items from metadata (or fetch from basket_sessions table)
     // For each item:
     //   1. Create purchase record (same as existing single-purchase flow)
     //   2. Calculate artist share: item_amount - platform_fee
     //   3. Create stripe.transfers.create({
     //        amount: artistShare,
     //        currency,
     //        destination: artist_stripe_account_id,
     //        source_transaction: charge_id, // from the PaymentIntent
     //      })
     // Progressive fan account creation (same as existing)
     // Download grants for each release
     // Emails: single receipt listing all purchased items
   }
   ```

### Files To Modify

- **`app/components/ui/AppNav.tsx`** — add BasketButton next to ProfileMenu
- **`app/[slug]/ArtistProfileClient.tsx`** — add "Add to basket" next to Buy button on release rows
- **`app/release/ReleaseClient.tsx`** — add "Add to basket" next to "Buy" button, swap WishlistButton → FavouriteButton
- **`app/search/SearchClient.tsx`** — optionally add basket button to release results
- **`app/discover/DiscoverClient.tsx`** — optionally add basket button

### Key Stripe Details

- `stripe.transfers.create()` requires `source_transaction` (the charge ID, not the PI ID). Get charge from `pi.latest_charge`.
- Each transfer has its own `transfer_group` for correlation.
- Zero-fees per artist: check each artist's zero-fees status individually. Some items may have 0% fee, others 10%.
- Currency: all items in the basket should use the same currency (fan's currency). Stripe Checkout handles this.
- The platform's Stripe account collects the full amount. Transfers happen from platform balance.

### Existing Patterns To Follow

- **Edge function structure:** Copy from `checkout-create/index.ts` — CORS, json helper, Deno.serve
- **Webhook structure:** Follow the existing `checkout.session.completed` handler pattern
- **Zustand store:** Follow `lib/stores/wishlist.ts` or `lib/stores/favourites.ts`
- **UI components:** All Tailwind, inline SVG icons, no icon library, orange-600 accent
- **Toast pattern:** `showToast(msg)` with timeout, fixed-bottom-center positioning

### Edge Cases

- PWYW in basket: store `customAmountPence` per item. Validate in edge function.
- Pre-orders in basket: mixed pre-order + immediate items. Download grants only for non-pre-order items.
- Same release added twice: prevent in store (basket.has check)
- Artist buys own release: no special handling needed
- Basket item becomes unpublished before checkout: validate in edge function, return error for stale items
