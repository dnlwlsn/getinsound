# Multi-Currency & Locale Detection — Design Spec

## Overview

Add full locale detection, multi-currency pricing, and region-aware Stripe fee calculation to Insound. Artists set prices in their own currency. Fans see prices converted to their detected or chosen currency. All fee calculations account for cross-region and cross-currency charges.

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Artist currency support | Full multi-currency (not display-only) | Artists set prices in their native currency via Stripe account |
| Currency switcher style | Globe icon + styled dropdown | Recognizable pattern, fits dark theme, scales to more currencies |
| Exchange rate source | ExchangeRate-API (free tier) | Covers all currencies, generous free tier, 1-hour cache is sufficient |
| Fan preference storage | Cookie + DB sync | Anonymous visitors get cookie-based detection; logged-in fans get cross-device persistence |

## Supported Currencies

| Country | Currency | Symbol | Stripe Fixed Fee |
|---------|----------|--------|-----------------|
| GB | GBP | £ | £0.20 |
| US | USD | $ | $0.30 |
| EU (19 countries: DE, FR, ES, IT, NL, BE, AT, IE, PT, FI, GR, LU, MT, SK, SI, EE, LV, LT, CY) | EUR | € | €0.25 |
| CA | CAD | C$ | Verify via Stripe |
| AU | AUD | A$ | Verify via Stripe |
| JP | JPY | ¥ | Verify via Stripe |

Fallback for all other countries: USD.

---

## 1. Locale & Currency Detection

### Middleware (`middleware.ts`)

Runs on every request. Detection order:

1. Check `insound_locale` cookie — if present, skip detection
2. Read `CF-IPCountry` header (Cloudflare Pages provides this automatically)
3. Parse `Accept-Language` header as fallback
4. Map country code to currency using the country-to-currency mapping
5. Set `insound_locale` cookie (country code, 30-day expiry)
6. Set `insound_currency` cookie if not already present (auto-detected currency, 30-day expiry)
7. Continue to existing auth middleware logic (artist route protection, signup redirects)

The middleware must preserve all existing auth/routing behavior. Locale detection is additive — it runs before the auth checks and sets cookies on the response.

### Client-Side Fallback

In `CurrencyProvider`: if no cookies exist (edge case — static pages served from CDN cache before middleware runs), use `navigator.language` and `Intl` API to detect locale and map to currency. Same country-to-currency mapping as server-side.

### Country-to-Currency Mapping

```
GB → GBP
US → USD
DE, FR, ES, IT, NL, BE, AT, IE, PT, FI, GR, LU, MT, SK, SI, EE, LV, LT, CY → EUR
CA → CAD
AU → AUD
JP → JPY
All others → USD
```

### Cookies

| Cookie | Value | Expiry | Purpose |
|--------|-------|--------|---------|
| `insound_locale` | ISO country code (e.g. `GB`) | 30 days | Detected locale, used for formatting |
| `insound_currency` | ISO currency code (e.g. `GBP`) | 30 days | Display currency, can be overridden by fan |

---

## 2. CurrencyContext Provider

New file: `app/providers/CurrencyProvider.tsx`

### Interface

```typescript
interface CurrencyContextValue {
  locale: string              // Country code (e.g. 'GB')
  currency: string            // Currency code (e.g. 'GBP')
  setCurrency: (code: string) => void
  formatPrice: (amount: number, currency?: string) => string
  exchangeRates: Record<string, number>
  convertPrice: (amount: number, fromCurrency: string, toCurrency: string) => number
}
```

### Behaviour

- Wraps the app in `layout.tsx` (added around `{children}`, alongside `PlayerBar`)
- Reads initial `locale` and `currency` from cookies (passed from server component via props)
- `setCurrency` updates the `insound_currency` cookie client-side, and if the user is authenticated, calls `POST /api/fan-preferences` to sync to the DB
- Exchange rates fetched once on mount from `GET /api/exchange-rates`, stored in state
- Provides `formatPrice` and `convertPrice` as convenience methods wrapping the pure utility functions with the current locale/rates

### Server-Side Initialization

The root `layout.tsx` reads cookies server-side and passes `initialLocale` and `initialCurrency` as props to `CurrencyProvider`. This avoids a flash of wrong currency on first render.

---

## 3. Utility Functions

### `app/lib/currency.ts`

Pure functions, no React dependency. Importable from both client and server code.

#### `formatPrice(amount: number, currency: string, locale?: string): string`

- Uses `Intl.NumberFormat` with `style: 'currency'`
- Handles symbol placement per locale (£10 vs 10 €)
- 0 decimal places for JPY, 2 for all others
- Thousands separators per locale
- `locale` parameter maps country code to BCP 47 locale tag (GB → en-GB, DE → de-DE, etc.)

#### `convertPrice(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number`

- Converts via USD base rate (ExchangeRate-API returns USD-based rates)
- Formula: `amount / rates[fromCurrency] * rates[toCurrency]`
- Rounds to 2 decimal places (0 for JPY)

#### `getCurrencyForCountry(countryCode: string): string`

- Implements the country-to-currency mapping
- Returns `'USD'` for unknown countries

#### `getLocaleForCountry(countryCode: string): string`

- Maps country code to BCP 47 locale tag for `Intl.NumberFormat`
- e.g. `GB → 'en-GB'`, `DE → 'de-DE'`, `JP → 'ja-JP'`

### `app/lib/fees.ts` (updated)

#### `calculateStripeFee(amount, fanRegion, artistRegion, fanCurrency, artistCurrency)`

Parameters:
- `amount`: sale price in the artist's currency
- `fanRegion`: fan's country code
- `artistRegion`: artist's country code
- `fanCurrency`: fan's display currency
- `artistCurrency`: artist's default currency

Returns:
```typescript
{
  stripeFee: number       // Base Stripe processing fee
  conversionFee: number   // Stripe currency conversion fee (2% if currencies differ, else 0)
  internationalFee: number // International card surcharge (1.5% if cross-region, else 0)
  insoundFee: number      // 10% platform fee
  artistReceived: number  // amount - all fees
  totalFees: number       // sum of all fees
}
```

Fee logic:
- Determine base rate from artist's region:
  - UK: 1.5% + £0.20
  - EEA: 1.5% + €0.25
  - US: 2.9% + $0.30
  - Other: use US rates as default
- If fan is outside artist's region: add 1.5% international surcharge
- If fan's currency differs from artist's currency: add 2% conversion fee
- Insound fee: 10% of sale price
- Artist received: sale price minus all fees

Note: These rates should be verified against Stripe's current pricing page during implementation. The utility should define rates as constants at the top of the file for easy updates.

#### Backward Compatibility

Existing `calculateFees(salePrice)` and `calculateFeesPence(amountPence)` remain as wrappers that call the new function with `fanRegion='GB'`, `artistRegion='GB'`, `fanCurrency='GBP'`, `artistCurrency='GBP'`.

---

## 4. Exchange Rate Caching

### API Route: `app/api/exchange-rates/route.ts`

- `GET` handler
- Fetches from `https://open.er-api.com/v6/latest/USD` (free, no API key required)
- Caches response in module-level variable with timestamp
- Returns cached rates if less than 1 hour old
- Returns JSON: `{ base: 'USD', rates: { GBP: 0.79, EUR: 0.92, ... }, cachedAt: ISO timestamp }`
- On fetch failure: returns last cached rates if available, or a 503

### API Route: `app/api/fan-preferences/route.ts`

- `POST` handler — upserts `fan_preferences` row for authenticated user
- Body: `{ display_currency: string, locale?: string }`
- Returns 401 if not authenticated
- `GET` handler — returns current preferences for authenticated user

---

## 5. Database Changes

### Migration: `0008_multi_currency.sql`

```sql
-- 1. Add default_currency to artists
ALTER TABLE public.artists
  ADD COLUMN default_currency text NOT NULL DEFAULT 'GBP';

-- 2. Remove GBP-only constraint on releases
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_currency_check;

-- 3. Add expanded currency constraint
ALTER TABLE public.releases
  ADD CONSTRAINT releases_currency_check
  CHECK (currency IN ('GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY'));

-- 4. Create fan_preferences table
CREATE TABLE public.fan_preferences (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_currency text NOT NULL DEFAULT 'GBP',
  locale           text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS for fan_preferences
ALTER TABLE public.fan_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.fan_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
  ON public.fan_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.fan_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Add fan_currency and fan_amount to purchases for per-sale reporting
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS fan_currency text,
  ADD COLUMN IF NOT EXISTS fan_amount integer;
```

Note: If the `purchases` table doesn't exist yet or has a different name, this migration adapts to whatever table stores completed sales. The columns store what the fan was charged (currency + amount in smallest unit) so the artist dashboard can show per-sale currency detail.

### Artist `default_currency` Population

During Stripe onboarding (when artist connects their Stripe account), read the Stripe account's `default_currency` and store it on the `artists.default_currency` column. For existing artists, default remains GBP.

---

## 6. Currency Switcher Component

### `app/components/ui/CurrencySwitcher.tsx`

- Globe SVG icon + styled `<select>` dropdown
- Displays current currency with symbol: "GBP (£)"
- Options: GBP (£), USD ($), EUR (€), CAD (C$), AUD (A$), JPY (¥)
- On change: calls `setCurrency()` from CurrencyContext
- Styling: matches Insound dark theme
  - Background: `#0A0A0A` / `zinc-900`
  - Text: `zinc-400`, hover `zinc-200`
  - Accent on selected/focus: `#F56D00`
  - Font: Montserrat (`font-display`)
  - Size: `text-sm`
  - Border: `border-zinc-800`

### Footer Integration

Added to `Footer.tsx` as a new element between the nav links and the copyright line. Positioned to the right on desktop, centered on mobile.

---

## 7. Price Display Updates

### Pattern

Every price display in the app follows this pattern:

**When showing a price in the fan's currency (converted from artist's currency):**
```
{formatPrice(convertedAmount, fanCurrency, fanLocale)}
<span class="text-xs text-zinc-500">
  (approximately {formatPrice(originalAmount, artistCurrency)})
</span>
```

**When showing a price in the artist's own currency (no conversion):**
```
{formatPrice(amount, artistCurrency, artistLocale)}
```

### Pages to Update

| Page | Component | Changes |
|------|-----------|---------|
| Homepage | `HomeClient.tsx` | Calculator uses fan's currency, stat cards adapt, breakdown example dynamic |
| /for-artists | `ForArtistsClient.tsx` | All pricing references use formatPrice, "10%" stays fixed |
| /for-fans | `ForFansClient.tsx` | £10 breakdown becomes dynamic per currency |
| /for-press | `page.tsx` | Key facts pricing uses formatPrice |
| Artist profile | `ArtistProfileClient.tsx` (in `[slug]`) | Release prices converted to fan's currency with artist's original shown |
| Explore | `ExploreClient.tsx` | Release prices on cards, cart summary |
| Release/Checkout | `ReleaseClient.tsx` | Full fee breakdown — see Section 8 |
| Dashboard | `DashboardClient.tsx` | All earnings in artist's currency |
| Sales | `SalesClient.tsx` | Balance and payout amounts in artist's currency |

### Homepage Calculator Special Case

The existing locale detection logic in `HomeClient.tsx` (the `navigator.language` mapping) is replaced by reading from `CurrencyContext`. The calculator dynamically shows fees for the fan's detected currency and a hypothetical same-region artist, with a note that fees vary by region.

---

## 8. Checkout Flow

### Display in Checkout Modal (`ReleaseClient.tsx`)

Line items shown to the fan:

```
Price:                    $12.50 (USD)
Stripe processing fee:    $0.67
Currency conversion fee:  $0.25
Insound fee (10%):        $1.25
─────────────────────────────────
Artist receives:          £8.10 (GBP)

You'll be charged $12.50 USD.
The artist receives payment in GBP.
```

- Price shown in fan's currency (converted from artist's currency using cached rate)
- All fee line items in fan's currency
- Artist receives shown in artist's currency
- Conversion fee only appears if fan's currency differs from artist's currency
- International surcharge rolled into "Stripe processing fee" (not shown separately to avoid confusion)

### Edge Function Updates (`checkout-create`)

- Receives `fan_currency` and `fan_locale` (from `insound_locale` cookie, forwarded by the client) in the request body
- Passes `currency: fan_currency.toLowerCase()` to the Stripe checkout session
- Stripe handles the actual conversion at their rate at point of sale
- `application_fee_amount` calculated using the region-aware fee function

---

## 9. Artist Dashboard

### Earnings Display

- All monetary values in artist's `default_currency`
- Uses `formatPrice(amount, artistCurrency)` throughout

### Per-Sale Detail

Each sale record shows:
- Date
- Release name
- Fan paid: `formatPrice(fanAmount, fanCurrency)` — what the fan was charged
- Artist received: `formatPrice(artistAmount, artistCurrency)` — what landed in the artist's Stripe account
- Fees: total fees deducted

This requires storing `fan_currency` and `fan_amount` on the purchase/sale record, populated by the Stripe webhook when processing `checkout.session.completed`.

---

## 10. Testing Scenarios

1. **UK fan buying from UK artist** — no conversion, base GBP fees (1.5% + £0.20)
2. **US fan buying from UK artist** — USD display, GBP artist receives, international surcharge + conversion fee
3. **EU fan buying from US artist** — EUR display, USD artist receives, different base rate + conversion fee
4. **Currency switcher** — fan manually selects JPY, prices update with 0 decimal places, preference persists across pages and sessions
5. **Anonymous visitor** — locale detected from headers, currency cookie set, no DB sync
6. **Logged-in fan switches currency** — cookie updated AND fan_preferences row upserted
