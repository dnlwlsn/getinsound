# Insound Audit Fixes — Session Instructions

**Updated:** 2026-04-30
**Purpose:** Track audit fixes completed and provide instructions for remaining work.

---

## Completed (20 fixes across 2 sessions)

1. **CSRF fix** — `middleware.ts` — strict hostname comparison instead of `startsWith`
2. **Auth redirect** — `AuthClient.tsx` — returning users go to `/` not `/welcome`
3. **Nav skeleton** — `AppNav.tsx` — shows logo during auth check instead of blank flash
4. **Hamburger menu** — `AppNav.tsx` — useful links (Settings, For Artists, FAQ) instead of duplicates
5. **Nav shown on more pages** — `AppNav.tsx` — FAQ, Privacy, Terms, AI Policy now get global nav
6. **PWYW sticky bar** — `ReleaseClient.tsx` — passes custom amount instead of ignoring it
7. **Player-aware sticky bar** — `ReleaseClient.tsx` — positions above player when active
8. **Album art bigger on mobile** — `ReleaseClient.tsx` — 280px max instead of 160px
9. **`<img>` to `next/image`** — `HomeClient.tsx` — homepage grid uses optimized images
10. **`prefers-reduced-motion`** — `globals.css` — respects accessibility setting
11. **Preview end buy prompt** — `PlayerBar.tsx` — shows "Preview ended — buy the full track" banner with link, auto-dismisses after 6s
12. **Slug validation on step 1** — `BecomeArtistClient.tsx` — validates regex, reserved slugs, and DB uniqueness before advancing from step 1
13. **Digital consent pre-purchase** — `ReleaseClient.tsx` — consent checkbox moved inline near buy button, recorded at checkout creation, post-payment consent stage removed
14. **Dashboard currency** — `DashboardClient.tsx` + `AnalyticsCharts.tsx` — derives currency from `account.default_currency` instead of hardcoding GBP
15. **Remaining `<img>` → `next/image`** — `PlayerBar.tsx`, `DiscoverClient.tsx`, `Shelf.tsx`, `SocialProofStrip.tsx`
16. **Stripe.js unification** — `lib/stripe.ts` created, `ReleaseClient.tsx`, `BasketDrawer.tsx`, `MerchItemClient.tsx` all use shared `stripePromise`
17. **Footer component** — `app/components/ui/Footer.tsx` created, replaced inline footers in FAQ, Privacy, Terms, AI Policy, For Fans, For Press, For Artists
18. **Download format honesty** — `LibraryClient.tsx` — removed fake format picker, serves original format with honest labelling
19. **Add-to-basket on browse cards** — `ExploreClient.tsx`, `DiscoverClient.tsx` — basket button appears on hover over cover art
20. **Play buttons autoplay** — `DiscoverClient.tsx` play buttons navigate with `?autoplay=true`, `ReleaseClient.tsx` handles autoplay param

---

## Remaining: Fan Order History Page

The only audit fix still outstanding. The API already exists.

### Step 1: Create the page and client component

- Create `app/orders/page.tsx` (server component)
  - Auth-gate: redirect to `/auth` if no user
  - Fetch orders via `supabase.from('orders').select('*, merch(name, photos), artists(name, slug, accent_colour)').eq('fan_id', user.id).order('created_at', { ascending: false })`
  - Render `<OrdersClient orders={data} />`
  - Include `<AppNav />` at the top

- Create `app/orders/OrdersClient.tsx` (`'use client'`)
  - Props: `orders` array with shape from `database.types.ts` `orders.Row` plus joined `merch` and `artists`
  - Show each order as a card with:
    - Merch photo (first from `merch.photos[]`, use `next/image`)
    - Merch name, artist name (link to `/${artists.slug}`)
    - Amount paid: `formatPrice(order.amount_paid / 100, order.amount_paid_currency)`
    - Status badge: `paid` → yellow, `dispatched` → blue, `delivered` → green, `returned` → red
    - Date: `order.created_at` formatted
    - If `dispatched_at`: show dispatch date
    - If `carrier` + `tracking_number`: show tracking link using `getTrackingUrl(carrier, tracking_number)` from `@/lib/carriers`
    - If `delivered_at`: show delivery date
  - Empty state: "No orders yet" with link to `/explore`
  - Use `<Footer />` at the bottom

### Step 2: Link from nav and library

- `AppNav.tsx`: Add "Orders" link to the hamburger menu (below Settings, above For Artists). Only show when user is logged in. Href: `/orders`
- `LibraryClient.tsx`: The orders tab already exists in Library showing merch orders inline. Add a "View all orders →" link at the top of that tab section pointing to `/orders`

### Key files to reference

- **API:** `app/api/orders/mine/route.ts` — already returns `{ orders: [...] }` with merch + artist joins
- **DB shape:** `lib/database.types.ts` → `orders.Row` — fields: `id`, `merch_id`, `fan_id`, `artist_id`, `amount_paid`, `amount_paid_currency`, `status`, `carrier`, `tracking_number` (on shipping_address or separate), `created_at`, `dispatched_at`, `delivered_at`, `return_requested_at`, `returned_at`, `shipping_address` (JSON), `postage_paid`
- **Tracking URLs:** `lib/carriers.ts` → `getTrackingUrl(carrier, trackingNumber)`
- **Currency formatting:** `app/lib/currency.ts` → `formatPrice(amount, currency)`
- **Shared footer:** `app/components/ui/Footer.tsx`
- **Design patterns:** Follow the same card style as `LibraryClient.tsx` order cards and `DashboardClient.tsx` merch order management

---

## Future Discussion Items

- **Independent labels** — how Bandcamp handles labels, what model would work for Insound
- **Magic link removal** — Dan may remove for other reasons
- **Age gate** — keeping for legal reasons (not just Stripe)
- **Dashboard refactor** — 1600-line monolith should be separate routes (large scope)
- **Fan social features** — playlists, following fans, gifting music
- **Editorial content** — Insound Selects with editorial write-ups
- **Add-to-basket on HomeClient** — ExploreClient and DiscoverClient have it now; HomeClient grid cards could get the same treatment
