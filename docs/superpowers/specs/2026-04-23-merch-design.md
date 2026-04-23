# Artist-Fulfilled Merch Listings — Design Spec

## Overview

Insound facilitates payment for physical merchandise listed and fulfilled by artists. Artists create listings, set prices and postage, and handle packing/shipping themselves. Insound takes 10% of item price only (not postage). Tracked shipping is mandatory — the tracking record resolves "not received" disputes.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Carrier integration | Manual tracking entry | No label generation — artists buy shipping however they want, paste tracking number |
| Checkout mode | Embedded Checkout | Consistent with music purchase flow |
| Fee model | Fan pays item + postage only | Fees deducted from artist side, same as music purchases |
| Fee breakdown | Informational on merch page | Shown before checkout for transparency, not added to price |
| Merch display | Dedicated page `/[slug]/merch/[merch-id]` | Shareable URLs for social media promotion |
| Shipping address storage | Plain JSONB with RLS | RLS restricts to artist + fan; encryption adds complexity for same threat model |
| Disputes & returns | Full implementation | Automated dispute resolution + UK consumer law returns from day one |
| Delivery tracking | Artist marks delivered | One-time TrackingMore lookup at dispute time only |
| Return address | Required on artists table before listing merch | New `return_address` jsonb field |

## Schema

### `merch` table

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | `gen_random_uuid()` |
| artist_id | uuid, FK artists | `on delete cascade` |
| name | text, not null | |
| description | text, not null | |
| price | integer, not null | Smallest currency unit (pence/cents), minimum £2 equivalent |
| currency | text, not null | Artist's default currency |
| postage | integer, not null | Smallest currency unit |
| stock | integer, not null | Decremented on purchase, cannot buy at 0 |
| variants | jsonb, nullable | Array of strings, e.g. `["S","M","L","XL"]` |
| dispatch_estimate | text, not null | e.g. "Ships within 3 days" |
| photos | jsonb, not null, default '[]' | Array of Supabase Storage paths |
| is_active | boolean, default true | Artist can deactivate |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, default now() | With auto-update trigger |

RLS: public read where `is_active = true`, artist insert/update/delete on own rows.

### `orders` table

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | `gen_random_uuid()` |
| fan_id | uuid, FK auth.users | |
| artist_id | uuid, FK artists | |
| merch_id | uuid, FK merch | |
| variant_selected | text, nullable | |
| amount_paid | integer, not null | Total charged to fan (item + postage) |
| amount_paid_currency | text, not null | |
| artist_received | integer, not null | After all fees |
| artist_received_currency | text, not null | |
| platform_pence | integer, not null | Insound's 10% of item price |
| stripe_fee_pence | integer, not null | Stripe processing fee |
| postage_paid | integer, not null | Full postage amount |
| shipping_address | jsonb, not null | `{name, line1, line2, city, postcode, country}` |
| tracking_number | text, nullable | Added by artist |
| carrier | text, nullable | `royal_mail`, `evri`, `dpd`, `yodel`, `other` |
| status | text, not null, default 'pending' | Check: `pending, dispatched, delivered, return_requested, returned, refunded, dispute` |
| stripe_payment_intent_id | text, unique | |
| stripe_checkout_id | text, unique | |
| created_at | timestamptz, default now() | |
| dispatched_at | timestamptz, nullable | |
| delivered_at | timestamptz, nullable | |
| return_requested_at | timestamptz, nullable | |
| returned_at | timestamptz, nullable | |

RLS: artist reads own orders, fan reads own orders, service role writes.

### `platform_costs` table

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | `gen_random_uuid()` |
| cost_type | text, not null | Check: `merch_lost_in_transit, merch_return_stripe_fee, other` |
| amount | integer, not null | Smallest currency unit |
| currency | text, not null | |
| related_order_id | uuid, FK orders, nullable | |
| related_purchase_id | uuid, FK purchases, nullable | |
| notes | text, nullable | |
| created_at | timestamptz, default now() | |

RLS: service role only.

### Storage

New `merch-images` bucket (public read). Path pattern: `{artist_id}/{merch_id}/{index}.jpg`. Artist writes to own folder via RLS.

### `artists` table addition

New column: `return_address` (jsonb, nullable) — `{name, line1, line2, city, postcode, country}`. Required before first merch listing.

## Purchase Flow

1. Fan views merch on artist profile (card grid below releases, "Merch" subheading)
2. Fan clicks card → navigates to `/[slug]/merch/[merch-id]`
3. Merch page shows: photo gallery, name, description, dispatch estimate, variant selector, stock indicator
4. Informational fee breakdown shown:
   - Item: £15.00
   - Postage: £3.50
   - **You pay: £18.50**
   - *Artist receives: ~£15.15 after Insound fee (£1.50) and Stripe fee (~£0.35)*
5. Fan clicks "Buy" → Stripe Embedded Checkout opens
   - `amount` = item + postage
   - `application_fee_amount` = 10% of item price only
   - `shipping_address_collection` enabled
   - `metadata: { type: 'merch', merch_id, variant, artist_id, fan_id }`
6. On `checkout.session.completed` webhook:
   a. Idempotency check on `stripe_checkout_id`
   b. Insert into `orders` table
   c. Atomic stock decrement: `UPDATE merch SET stock = stock - 1 WHERE id = $1 AND stock > 0`
   d. If decrement affects 0 rows → refund payment, notify fan "sold out"
   e. If stock hits 0 after decrement → notify artist "sold out"
   f. Extract shipping address from Stripe session
   g. Notify artist: in-app + email
   h. Notify fan: in-app + email

## Order Management (Artist Dashboard)

New "Orders" sub-tab within Merch dashboard section.

### Orders list
- Table sorted newest first, filterable by status
- Each order: item name, variant, fan name, date, status badge, dispatch deadline

### Order actions by status

**`pending`:** Enter tracking number + select carrier (Royal Mail, Evri, DPD, Yodel, Other) → status moves to `dispatched`, fan notified with tracking link.

**`dispatched`:** "Mark as delivered" → status moves to `delivered`, fan notified.

**`return_requested`:** "Confirm return received" → triggers refund flow.

**`dispute`:** Show dispute details and resolution.

### Carrier tracking links
- `royal_mail` → `https://www.royalmail.com/track-your-item#/tracking-results/{tracking_number}`
- `evri` → `https://www.evri.com/track/parcel/{tracking_number}`
- `dpd` → `https://track.dpd.co.uk/parcels/{tracking_number}`
- `yodel` → `https://www.yodel.co.uk/tracking/{tracking_number}`

## Fan Order History

In Library page, new "Orders" section.

### Orders list
- Card list: thumbnail, name, variant, artist, date, status badge, price
- Tracking link when tracking number exists

### Fan order detail (`/library/orders/[order-id]`)
- Full item details, shipping address, status timeline, tracking link
- "Report a problem" button (available after dispatch)
- "Request return" button (within 14 days of `delivered_at`)

## Dispute Flow

Fan clicks "Report a problem":

### 1. One-time tracking lookup
Call TrackingMore API with tracking number + carrier.

### 2. Branch on result

**(a) Tracking shows delivered:**
Show message: "According to tracking, this item was delivered on [date]. If you believe there's an error, please contact [Artist Name] directly." Show artist's contact/social links. No refund triggered.

**(b) Tracking shows lost in transit** (stuck/exception 14+ days or carrier confirms lost):
- Automatic 50/50 refund
- Half refunded to fan via Stripe refund on original payment intent
- Insound's half logged in `platform_costs` (`merch_lost_in_transit`)
- Fan receives full refund of item + postage
- Both parties notified (in-app + email)
- Order status → `refunded`

**(c) No tracking number within 14 days of order:**
- Full refund from artist (Stripe refund on original charge)
- Application fee auto-reversed by Stripe
- Order status → `refunded`
- Artist notified, order flagged

**(d) Tracking lookup fails** (API down, invalid number):
- Notify admin via email
- Fan shown: "We're looking into this and will get back to you within 48 hours."
- Order status → `dispute`

## Return Flow (UK Consumer Law)

14-day return window after delivery. Exceptions: personalised/custom items, sealed hygiene items. Return postage at fan's cost.

### Fan requests return
1. Fan clicks "Request return" within 14 days of `delivered_at`
2. Confirmation prompt explains terms and exceptions
3. Status → `return_requested`, `return_requested_at` = now()
4. Fan shown artist's return address and instructions
5. Fan ships item back at own cost

### Artist confirms receipt
1. Artist sees return request in dashboard
2. Artist notified (in-app + email)
3. When item arrives, artist clicks "Confirm return received"

### Refund on confirmation
- Stripe refund on original payment intent (full: item + postage)
- Stripe auto-reverses application fee
- Stripe's processing fee NOT refunded — Insound absorbs, logged in `platform_costs` (`merch_return_stripe_fee`)
- Fan notified of refund
- Status → `returned`, `returned_at` = now()

### Expiry
- Fan doesn't return within 14 days of `return_requested_at` → artist can dismiss, status reverts to `delivered`
- Artist doesn't confirm within 30 days of `return_requested_at` → auto-escalate to admin

## Notifications

| Event | Recipient | Type | Title |
|---|---|---|---|
| Order placed | Artist | `merch_order` | "New merch order: [item]" |
| Order placed | Fan | `merch_order` | "Order confirmed: [item]" |
| Dispatched | Fan | `merch_dispatched` | "[item] has been dispatched" |
| Delivered | Fan | `merch_delivered` | "[item] has been delivered" |
| Return requested | Artist | `merch_return` | "Return requested for [item]" |
| Return refunded | Fan | `merch_return` | "Your return has been refunded" |
| Dispute — lost | Both | `merch_dispute` | "Order refunded: [item]" |
| Dispute — no tracking | Artist | `merch_dispute` | "Order refunded — no tracking" |
| Stock hits 0 | Artist | `merch_order` | "[item] is now sold out" |

New notification types to add to `notification_preferences` check constraint: `merch_dispatched`, `merch_delivered`, `merch_return`, `merch_dispute`.

Each notification with `email = true` also sends via Resend using existing dark theme HTML template.

## Edge Functions & API Routes

### Supabase Edge Functions
- `checkout-merch-create` — creates Stripe Checkout session for merch
- `stripe-webhook` — extended with merch branch (check `metadata.type`)

### Next.js API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/merch` | `POST` | Create merch listing |
| `/api/merch/[id]` | `PATCH` | Update listing |
| `/api/merch/[id]` | `DELETE` | Soft delete |
| `/api/merch/[id]/photos` | `POST` | Upload photos |
| `/api/merch/[id]/photos/[index]` | `DELETE` | Remove photo |
| `/api/orders` | `GET` | Artist's orders |
| `/api/orders/mine` | `GET` | Fan's orders |
| `/api/orders/[id]/dispatch` | `PATCH` | Add tracking + dispatch |
| `/api/orders/[id]/deliver` | `PATCH` | Mark delivered |
| `/api/orders/[id]/confirm-return` | `PATCH` | Confirm return → refund |
| `/api/orders/[id]/report-problem` | `POST` | Dispute flow |
| `/api/orders/[id]/request-return` | `POST` | Return request |
| `/api/orders/[id]/refund` | `POST` | Internal Stripe refund |

### New Pages

| Route | Purpose |
|---|---|
| `/[slug]/merch/[merch-id]` | Public merch item page |
| `/library/orders/[order-id]` | Fan order detail |
