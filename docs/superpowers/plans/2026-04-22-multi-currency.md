# Multi-Currency & Locale Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add locale detection, multi-currency pricing, region-aware Stripe fees, and a currency switcher so fans see prices in their local currency and artists receive payments in theirs.

**Architecture:** Middleware detects locale from Cloudflare headers and sets cookies. A React context (`CurrencyProvider`) wraps the app, providing currency/locale state and formatPrice/convertPrice helpers. Exchange rates are cached server-side (1-hour TTL) via an API route hitting ExchangeRate-API. All 71+ hardcoded price displays are replaced with `formatPrice()` calls. The fee calculator becomes region-aware for accurate Stripe fee breakdowns.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + Edge Functions), Stripe Connect, `Intl.NumberFormat`, ExchangeRate-API (free tier), React Context

**Spec:** `docs/superpowers/specs/2026-04-22-multi-currency-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `app/lib/currency.ts` | Pure utility functions: `formatPrice`, `convertPrice`, `getCurrencyForCountry`, `getLocaleTag`, country-currency mapping |
| `app/providers/CurrencyProvider.tsx` | React context for currency state, cookie management, exchange rate fetching |
| `app/components/ui/CurrencySwitcher.tsx` | Globe icon + dropdown for manual currency override |
| `app/api/exchange-rates/route.ts` | Server-side exchange rate fetching + 1-hour cache |
| `app/api/fan-preferences/route.ts` | CRUD for logged-in fan's currency preference |
| `supabase/migrations/0008_multi_currency.sql` | Schema changes: `artists.default_currency`, `releases.currency` constraint, `fan_preferences` table, `purchases` fan currency columns |
| `app/lib/__tests__/currency.test.ts` | Tests for formatPrice, convertPrice, getCurrencyForCountry |
| `app/lib/__tests__/fees.test.ts` | Tests for region-aware fee calculation |

### Modified Files
| File | What Changes |
|------|-------------|
| `app/lib/fees.ts` | Add `calculateStripeFee()` with region/currency awareness; keep old functions as wrappers |
| `middleware.ts` | Add locale detection before auth logic (CF-IPCountry → Accept-Language → cookie) |
| `app/layout.tsx` | Read currency cookies server-side, wrap children in `CurrencyProvider` |
| `app/components/ui/Footer.tsx` | Add `CurrencySwitcher` component |
| `app/components/HomeClient.tsx` | Replace 26 hardcoded £ references with `formatPrice()` |
| `app/why-us/WhyUsClient.tsx` | Replace 12 hardcoded £ references |
| `app/for-artists/ForArtistsClient.tsx` | Replace 8 hardcoded £ references |
| `app/for-fans/ForFansClient.tsx` | Replace 7 hardcoded £ references |
| `app/for-fans/page.tsx` | Update meta description |
| `app/for-press/ForPressClient.tsx` | Replace 1 hardcoded £ reference |
| `app/[slug]/ArtistProfileClient.tsx` | Replace 2 hardcoded price displays |
| `app/[slug]/FanProfileClient.tsx` | Replace 1 purchase amount display |
| `app/release/ReleaseClient.tsx` | Replace 11 price displays, add multi-currency checkout breakdown |
| `app/explore/ExploreClient.tsx` | Replace 4 price displays |
| `app/dashboard/DashboardClient.tsx` | Replace `pence()` helper, show earnings in artist currency |
| `app/discography/DiscographyClient.tsx` | Replace `pence()` helper + 5 price references |
| `app/sales/SalesClient.tsx` | Replace 9 hardcoded price displays |
| `app/library/LibraryClient.tsx` | Replace 1 total contributed display |
| `app/components/ui/PayWhatYouWant.tsx` | Replace hardcoded `currency = '£'` default |
| `supabase/functions/checkout-create/index.ts` | Accept `fan_currency`, pass to Stripe session |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0008_multi_currency.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0008_multi_currency.sql
-- Adds multi-currency support: artist default currency, expanded release currencies,
-- fan preferences table, and purchase currency tracking.

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

CREATE POLICY "fan_prefs_select_self"
  ON public.fan_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "fan_prefs_insert_self"
  ON public.fan_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fan_prefs_update_self"
  ON public.fan_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Add fan currency columns to purchases
ALTER TABLE public.purchases
  ADD COLUMN fan_currency text,
  ADD COLUMN fan_amount integer;

-- 7. updated_at trigger for fan_preferences
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fan_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` or apply via Supabase Dashboard SQL Editor.
Expected: All statements succeed. Verify with:
```bash
npx supabase db diff
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_multi_currency.sql
git commit -m "feat: add multi-currency database schema — artists.default_currency, fan_preferences table, expanded releases.currency constraint"
```

---

## Task 2: Currency Utility Functions

**Files:**
- Create: `app/lib/currency.ts`
- Create: `app/lib/__tests__/currency.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/__tests__/currency.test.ts`:

```typescript
import { formatPrice, convertPrice, getCurrencyForCountry, getLocaleTag, SUPPORTED_CURRENCIES } from '../currency'

describe('getCurrencyForCountry', () => {
  it('maps GB to GBP', () => {
    expect(getCurrencyForCountry('GB')).toBe('GBP')
  })

  it('maps US to USD', () => {
    expect(getCurrencyForCountry('US')).toBe('USD')
  })

  it('maps EU countries to EUR', () => {
    expect(getCurrencyForCountry('DE')).toBe('EUR')
    expect(getCurrencyForCountry('FR')).toBe('EUR')
    expect(getCurrencyForCountry('ES')).toBe('EUR')
    expect(getCurrencyForCountry('IT')).toBe('EUR')
    expect(getCurrencyForCountry('NL')).toBe('EUR')
    expect(getCurrencyForCountry('BE')).toBe('EUR')
    expect(getCurrencyForCountry('AT')).toBe('EUR')
    expect(getCurrencyForCountry('IE')).toBe('EUR')
    expect(getCurrencyForCountry('PT')).toBe('EUR')
    expect(getCurrencyForCountry('FI')).toBe('EUR')
    expect(getCurrencyForCountry('GR')).toBe('EUR')
    expect(getCurrencyForCountry('LU')).toBe('EUR')
    expect(getCurrencyForCountry('MT')).toBe('EUR')
    expect(getCurrencyForCountry('SK')).toBe('EUR')
    expect(getCurrencyForCountry('SI')).toBe('EUR')
    expect(getCurrencyForCountry('EE')).toBe('EUR')
    expect(getCurrencyForCountry('LV')).toBe('EUR')
    expect(getCurrencyForCountry('LT')).toBe('EUR')
    expect(getCurrencyForCountry('CY')).toBe('EUR')
  })

  it('maps CA to CAD', () => {
    expect(getCurrencyForCountry('CA')).toBe('CAD')
  })

  it('maps AU to AUD', () => {
    expect(getCurrencyForCountry('AU')).toBe('AUD')
  })

  it('maps JP to JPY', () => {
    expect(getCurrencyForCountry('JP')).toBe('JPY')
  })

  it('defaults unknown countries to USD', () => {
    expect(getCurrencyForCountry('ZZ')).toBe('USD')
    expect(getCurrencyForCountry('BR')).toBe('USD')
    expect(getCurrencyForCountry('')).toBe('USD')
  })
})

describe('getLocaleTag', () => {
  it('maps country codes to BCP 47 locale tags', () => {
    expect(getLocaleTag('GB')).toBe('en-GB')
    expect(getLocaleTag('US')).toBe('en-US')
    expect(getLocaleTag('DE')).toBe('de-DE')
    expect(getLocaleTag('FR')).toBe('fr-FR')
    expect(getLocaleTag('JP')).toBe('ja-JP')
    expect(getLocaleTag('CA')).toBe('en-CA')
    expect(getLocaleTag('AU')).toBe('en-AU')
  })

  it('defaults unknown countries to en-US', () => {
    expect(getLocaleTag('ZZ')).toBe('en-US')
  })
})

describe('formatPrice', () => {
  it('formats GBP with £ symbol', () => {
    expect(formatPrice(10, 'GBP')).toBe('£10.00')
  })

  it('formats USD with $ symbol', () => {
    expect(formatPrice(10, 'USD')).toBe('$10.00')
  })

  it('formats EUR with € symbol', () => {
    const result = formatPrice(10, 'EUR')
    expect(result).toContain('€')
    expect(result).toContain('10')
  })

  it('formats JPY with no decimal places', () => {
    const result = formatPrice(1000, 'JPY')
    expect(result).toContain('¥')
    expect(result).not.toContain('.')
  })

  it('formats with locale-appropriate separators', () => {
    const result = formatPrice(1000, 'GBP', 'en-GB')
    expect(result).toContain('1,000')
  })

  it('handles zero', () => {
    expect(formatPrice(0, 'GBP')).toBe('£0.00')
  })

  it('handles negative values', () => {
    const result = formatPrice(-10, 'GBP')
    expect(result).toContain('10.00')
  })
})

describe('convertPrice', () => {
  const rates = { GBP: 0.79, USD: 1.0, EUR: 0.92, JPY: 155.0, CAD: 1.37, AUD: 1.55 }

  it('converts GBP to USD', () => {
    const result = convertPrice(10, 'GBP', 'USD', rates)
    expect(result).toBeCloseTo(12.66, 1)
  })

  it('converts USD to GBP', () => {
    const result = convertPrice(10, 'USD', 'GBP', rates)
    expect(result).toBeCloseTo(7.90, 1)
  })

  it('returns same amount when currencies match', () => {
    expect(convertPrice(10, 'GBP', 'GBP', rates)).toBe(10)
  })

  it('converts to JPY with 0 decimals', () => {
    const result = convertPrice(10, 'USD', 'JPY', rates)
    expect(result).toBe(1550)
  })

  it('converts between non-USD currencies via USD base', () => {
    const result = convertPrice(10, 'GBP', 'EUR', rates)
    expect(result).toBeCloseTo(11.65, 0)
  })
})

describe('SUPPORTED_CURRENCIES', () => {
  it('contains all 6 supported currencies with symbols', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(6)
    const codes = SUPPORTED_CURRENCIES.map(c => c.code)
    expect(codes).toContain('GBP')
    expect(codes).toContain('USD')
    expect(codes).toContain('EUR')
    expect(codes).toContain('CAD')
    expect(codes).toContain('AUD')
    expect(codes).toContain('JPY')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/lib/__tests__/currency.test.ts --no-cache 2>&1 | head -20`

If jest is not configured, first check `package.json` for a test runner. If none, install:
```bash
npm install -D jest @types/jest ts-jest
```
Create `jest.config.js` at project root if not present:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
```

Expected: All tests FAIL with "Cannot find module '../currency'"

- [ ] **Step 3: Write the implementation**

Create `app/lib/currency.ts`:

```typescript
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR',
  GR: 'EUR', LU: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR',
}

const COUNTRY_TO_LOCALE: Record<string, string> = {
  GB: 'en-GB', US: 'en-US', CA: 'en-CA', AU: 'en-AU', JP: 'ja-JP',
  DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', NL: 'nl-NL',
  BE: 'nl-BE', AT: 'de-AT', IE: 'en-IE', PT: 'pt-PT', FI: 'fi-FI',
  GR: 'el-GR', LU: 'fr-LU', MT: 'en-MT', SK: 'sk-SK', SI: 'sl-SI',
  EE: 'et-EE', LV: 'lv-LV', LT: 'lt-LT', CY: 'el-CY',
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY'])

export const SUPPORTED_CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
]

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_TO_CURRENCY[countryCode] || 'USD'
}

export function getLocaleTag(countryCode: string): string {
  return COUNTRY_TO_LOCALE[countryCode] || 'en-US'
}

export function formatPrice(amount: number, currency: string, locale?: string): string {
  const resolvedLocale = locale || (currency === 'GBP' ? 'en-GB' : currency === 'EUR' ? 'de-DE' : currency === 'JPY' ? 'ja-JP' : 'en-US')
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount
  const inUsd = amount / rates[fromCurrency]
  const converted = inUsd * rates[toCurrency]
  return ZERO_DECIMAL_CURRENCIES.has(toCurrency)
    ? Math.round(converted)
    : Math.round(converted * 100) / 100
}

export function isEEACountry(countryCode: string): boolean {
  const eea = new Set([
    'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI',
    'GR', 'LU', 'MT', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY',
    'BG', 'HR', 'CZ', 'DK', 'HU', 'PL', 'RO', 'SE',
    'IS', 'LI', 'NO',
  ])
  return eea.has(countryCode)
}

export function getRegion(countryCode: string): 'UK' | 'EEA' | 'US' | 'OTHER' {
  if (countryCode === 'GB') return 'UK'
  if (countryCode === 'US') return 'US'
  if (isEEACountry(countryCode)) return 'EEA'
  return 'OTHER'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest app/lib/__tests__/currency.test.ts --no-cache`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/currency.ts app/lib/__tests__/currency.test.ts
git commit -m "feat: add currency utility functions — formatPrice, convertPrice, country-to-currency mapping"
```

---

## Task 3: Region-Aware Fee Calculation

**Files:**
- Modify: `app/lib/fees.ts`
- Create: `app/lib/__tests__/fees.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/__tests__/fees.test.ts`:

```typescript
import { calculateStripeFee, calculateFees, calculateFeesPence } from '../fees'

describe('calculateStripeFee', () => {
  it('calculates UK domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.stripeFee).toBeCloseTo(0.35, 2) // 1.5% + £0.20
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2) // 10%
    expect(result.artistReceived).toBeCloseTo(8.65, 2)
  })

  it('calculates US domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'US', 'US', 'USD', 'USD')
    expect(result.stripeFee).toBeCloseTo(0.59, 2) // 2.9% + $0.30
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.artistReceived).toBeCloseTo(8.41, 2)
  })

  it('calculates EEA domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'DE', 'DE', 'EUR', 'EUR')
    expect(result.stripeFee).toBeCloseTo(0.40, 2) // 1.5% + €0.25
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.artistReceived).toBeCloseTo(8.60, 2)
  })

  it('adds international surcharge for cross-region', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.internationalFee).toBeCloseTo(0.15, 2) // 1.5% of 10
    expect(result.conversionFee).toBeCloseTo(0.20, 2) // 2% of 10
  })

  it('adds conversion fee when currencies differ', () => {
    const result = calculateStripeFee(10, 'DE', 'GB', 'EUR', 'GBP')
    expect(result.conversionFee).toBeCloseTo(0.20, 2) // 2% of 10
  })

  it('no conversion fee when currencies match even if cross-region', () => {
    // EEA fan buying from EEA artist, same currency
    const result = calculateStripeFee(10, 'FR', 'DE', 'EUR', 'EUR')
    expect(result.conversionFee).toBe(0)
    expect(result.internationalFee).toBe(0) // same region (EEA)
  })

  it('returns totalFees as sum of all fees', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.totalFees).toBeCloseTo(
      result.stripeFee + result.internationalFee + result.conversionFee + result.insoundFee,
      2
    )
  })

  it('artistReceived equals amount minus totalFees', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.artistReceived).toBeCloseTo(10 - result.totalFees, 2)
  })
})

describe('calculateFees (backward compat)', () => {
  it('returns same result as before for GBP domestic', () => {
    const result = calculateFees(10)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.stripeFee).toBeCloseTo(0.35, 2)
    expect(result.artistReceived).toBeCloseTo(8.65, 2)
  })
})

describe('calculateFeesPence (backward compat)', () => {
  it('returns same result as before for GBP domestic in pence', () => {
    const result = calculateFeesPence(1000)
    expect(result.insoundFee).toBe(100)
    expect(result.stripeFee).toBe(35)
    expect(result.artistReceived).toBe(865)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/lib/__tests__/fees.test.ts --no-cache 2>&1 | head -20`
Expected: FAIL — `calculateStripeFee` is not exported

- [ ] **Step 3: Write the implementation**

Replace the contents of `app/lib/fees.ts` with:

```typescript
import { getRegion } from './currency'

export const INSOUND_RATE = 0.10

const STRIPE_RATES: Record<string, { percent: number; fixed: number }> = {
  UK:    { percent: 0.015, fixed: 0.20 },
  EEA:   { percent: 0.015, fixed: 0.25 },
  US:    { percent: 0.029, fixed: 0.30 },
  OTHER: { percent: 0.029, fixed: 0.30 },
}

const INTERNATIONAL_SURCHARGE = 0.015
const CONVERSION_FEE_RATE = 0.02

export interface StripeFeeResult {
  stripeFee: number
  internationalFee: number
  conversionFee: number
  insoundFee: number
  artistReceived: number
  totalFees: number
}

export function calculateStripeFee(
  amount: number,
  fanRegion: string,
  artistRegion: string,
  fanCurrency: string,
  artistCurrency: string,
): StripeFeeResult {
  const artistRegionKey = getRegion(artistRegion)
  const fanRegionKey = getRegion(fanRegion)
  const rate = STRIPE_RATES[artistRegionKey]

  const stripeFee = round2(amount * rate.percent + rate.fixed)
  const internationalFee = fanRegionKey !== artistRegionKey
    ? round2(amount * INTERNATIONAL_SURCHARGE)
    : 0
  const conversionFee = fanCurrency !== artistCurrency
    ? round2(amount * CONVERSION_FEE_RATE)
    : 0
  const insoundFee = round2(amount * INSOUND_RATE)
  const totalFees = round2(stripeFee + internationalFee + conversionFee + insoundFee)
  const artistReceived = round2(amount - totalFees)

  return { stripeFee, internationalFee, conversionFee, insoundFee, artistReceived, totalFees }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Backward-compatible wrappers
export const STRIPE_RATE = 0.015
export const STRIPE_FIXED = 0.20

export function calculateFees(salePrice: number) {
  const result = calculateStripeFee(salePrice, 'GB', 'GB', 'GBP', 'GBP')
  return {
    insoundFee: result.insoundFee,
    stripeFee: round2(result.stripeFee + result.internationalFee + result.conversionFee),
    artistReceived: result.artistReceived,
  }
}

export function calculateFeesPence(amountPence: number) {
  const result = calculateStripeFee(amountPence / 100, 'GB', 'GB', 'GBP', 'GBP')
  return {
    insoundFee: Math.round(result.insoundFee * 100),
    stripeFee: Math.round((result.stripeFee + result.internationalFee + result.conversionFee) * 100),
    artistReceived: Math.round(result.artistReceived * 100),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest app/lib/__tests__/fees.test.ts --no-cache`
Expected: All tests PASS

- [ ] **Step 5: Also run currency tests to confirm no regressions**

Run: `npx jest app/lib/__tests__/ --no-cache`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add app/lib/fees.ts app/lib/__tests__/fees.test.ts
git commit -m "feat: region-aware Stripe fee calculation with international and conversion surcharges"
```

---

## Task 4: Exchange Rate API Route

**Files:**
- Create: `app/api/exchange-rates/route.ts`

- [ ] **Step 1: Create the exchange rate API route**

Create `app/api/exchange-rates/route.ts`:

```typescript
import { NextResponse } from 'next/server'

interface CachedRates {
  rates: Record<string, number>
  cachedAt: number
}

let cache: CachedRates | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      base: 'USD',
      rates: cache.rates,
      cachedAt: new Date(cache.cachedAt).toISOString(),
    })
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      if (cache) {
        return NextResponse.json({
          base: 'USD',
          rates: cache.rates,
          cachedAt: new Date(cache.cachedAt).toISOString(),
          stale: true,
        })
      }
      return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 503 })
    }

    const data = await res.json()
    cache = { rates: data.rates, cachedAt: Date.now() }

    return NextResponse.json({
      base: 'USD',
      rates: data.rates,
      cachedAt: new Date(cache.cachedAt).toISOString(),
    })
  } catch {
    if (cache) {
      return NextResponse.json({
        base: 'USD',
        rates: cache.rates,
        cachedAt: new Date(cache.cachedAt).toISOString(),
        stale: true,
      })
    }
    return NextResponse.json({ error: 'Exchange rate service unavailable' }, { status: 503 })
  }
}
```

- [ ] **Step 2: Test manually**

Run: `curl http://localhost:3000/api/exchange-rates 2>/dev/null | head -c 200`
Expected: JSON response with `base`, `rates`, `cachedAt` fields. `rates` should include `GBP`, `EUR`, `JPY`, etc.

- [ ] **Step 3: Commit**

```bash
git add app/api/exchange-rates/route.ts
git commit -m "feat: exchange rate API route with 1-hour in-memory caching"
```

---

## Task 5: Fan Preferences API Route

**Files:**
- Create: `app/api/fan-preferences/route.ts`

- [ ] **Step 1: Create the fan preferences API route**

Create `app/api/fan-preferences/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll()
        },
        async setAll(cookiesToSet) {
          const store = await cookieStore
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options)
          )
        },
      },
    },
  )
}

export async function GET() {
  const supabase = createSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fan_preferences')
    .select('display_currency, locale')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || { display_currency: 'GBP', locale: null })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { display_currency, locale } = body

  if (!display_currency) {
    return NextResponse.json({ error: 'display_currency required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fan_preferences')
    .upsert({
      user_id: user.id,
      display_currency,
      locale: locale || null,
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/fan-preferences/route.ts
git commit -m "feat: fan preferences API route for currency preference persistence"
```

---

## Task 6: Middleware — Locale Detection

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add locale detection to middleware**

Add locale detection logic at the **top** of the `middleware` function, before the Supabase auth logic. The key changes:

1. Import `getCurrencyForCountry` from `app/lib/currency`
2. Check for existing `insound_locale` cookie — skip detection if present
3. Read `CF-IPCountry` header (Cloudflare provides this)
4. Fall back to parsing `Accept-Language` header
5. Set `insound_locale` and `insound_currency` cookies on the response
6. All existing auth logic remains unchanged

Replace the full contents of `middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrencyForCountry } from './app/lib/currency'

const ARTIST_ROUTES = ['/dashboard', '/release']
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
const AUTH_EXCLUDED = ['/auth', '/signup', '/auth/callback', '/welcome', '/become-an-artist', '/api']

const THIRTY_DAYS = 60 * 60 * 24 * 30

function detectCountry(request: NextRequest): string | null {
  const cfCountry = request.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') return cfCountry

  const acceptLang = request.headers.get('accept-language')
  if (acceptLang) {
    const match = acceptLang.match(/[a-z]{2}-([A-Z]{2})/)
    if (match) return match[1]
  }

  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // ── Locale detection ──────────────────────────────────────
  const hasLocale = request.cookies.has('insound_locale')
  if (!hasLocale) {
    const country = detectCountry(request)
    if (country) {
      const currency = getCurrencyForCountry(country)
      supabaseResponse.cookies.set('insound_locale', country, {
        path: '/',
        maxAge: THIRTY_DAYS,
        sameSite: 'lax',
      })
      if (!request.cookies.has('insound_currency')) {
        supabaseResponse.cookies.set('insound_currency', currency, {
          path: '/',
          maxAge: THIRTY_DAYS,
          sameSite: 'lax',
        })
      }
    }
  }

  // ── Supabase auth ─────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (user && ARTIST_ROUTES.some(r => path.startsWith(r))) {
    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!artist) {
      const url = request.nextUrl.clone()
      url.pathname = '/become-an-artist'
      return NextResponse.redirect(url)
    }
  }

  if (!user && !PUBLIC_ROUTES.some(r => path === r) && !AUTH_EXCLUDED.some(r => path.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf)$).*)',
  ],
}
```

**Important note:** The Supabase `setAll` callback rebuilds `supabaseResponse` with `NextResponse.next({ request })`, which will lose the locale cookies set earlier. To fix this, we need to preserve the locale cookies. However, examining the existing code, the `setAll` is only called when Supabase needs to refresh session tokens — and in the new response, the request cookies already include the locale values (set via `request.cookies.set` in the supabase getAll/setAll flow). The response cookies are what matter for the browser. So we need to re-apply locale cookies after the Supabase client is created if `setAll` was called.

Actually, a simpler approach: set the locale cookies at the **end** of the function, right before `return supabaseResponse`. Replace the locale detection section at the top with just detection logic, and move the cookie-setting to the end:

```typescript
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // ── Locale detection (compute only) ───────────────────────
  let detectedCountry: string | null = null
  let detectedCurrency: string | null = null
  const hasLocale = request.cookies.has('insound_locale')
  if (!hasLocale) {
    detectedCountry = detectCountry(request)
    if (detectedCountry) {
      detectedCurrency = getCurrencyForCountry(detectedCountry)
    }
  }

  // ── Supabase auth (unchanged — may rebuild supabaseResponse) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (user && ARTIST_ROUTES.some(r => path.startsWith(r))) {
    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!artist) {
      const url = request.nextUrl.clone()
      url.pathname = '/become-an-artist'
      return NextResponse.redirect(url)
    }
  }

  if (!user && !PUBLIC_ROUTES.some(r => path === r) && !AUTH_EXCLUDED.some(r => path.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  // ── Set locale cookies (after Supabase may have rebuilt response) ──
  if (detectedCountry) {
    supabaseResponse.cookies.set('insound_locale', detectedCountry, {
      path: '/',
      maxAge: THIRTY_DAYS,
      sameSite: 'lax',
    })
    if (detectedCurrency && !request.cookies.has('insound_currency')) {
      supabaseResponse.cookies.set('insound_currency', detectedCurrency, {
        path: '/',
        maxAge: THIRTY_DAYS,
        sameSite: 'lax',
      })
    }
  }

  return supabaseResponse
}
```

Use this second version — it correctly handles the case where Supabase's `setAll` rebuilds the response object.

- [ ] **Step 2: Verify the dev server starts without errors**

Run: `npm run dev` and visit `http://localhost:3000`. Check browser cookies — `insound_locale` and `insound_currency` should appear (will default based on Accept-Language since you're on localhost, not Cloudflare).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: locale and currency detection in middleware via CF-IPCountry and Accept-Language"
```

---

## Task 7: CurrencyProvider Context

**Files:**
- Create: `app/providers/CurrencyProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the CurrencyProvider**

Create `app/providers/CurrencyProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { formatPrice as formatPriceUtil, convertPrice as convertPriceUtil, getCurrencyForCountry } from '../lib/currency'

interface CurrencyContextValue {
  locale: string
  currency: string
  setCurrency: (code: string) => void
  formatPrice: (amount: number, currency?: string) => string
  exchangeRates: Record<string, number>
  convertPrice: (amount: number, fromCurrency: string, toCurrency: string) => number
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};path=/;expires=${expires};samesite=lax`
}

interface Props {
  children: ReactNode
  initialLocale: string
  initialCurrency: string
}

export function CurrencyProvider({ children, initialLocale, initialCurrency }: Props) {
  const [locale, setLocale] = useState(initialLocale)
  const [currency, setCurrencyState] = useState(initialCurrency)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!locale || locale === 'XX') {
      try {
        const browserLocale = navigator.language || 'en-US'
        const match = browserLocale.match(/[a-z]{2}-([A-Z]{2})/)
        const country = match ? match[1] : 'US'
        setLocale(country)
        if (!currency || currency === 'USD') {
          const detected = getCurrencyForCountry(country)
          setCurrencyState(detected)
          setCookie('insound_locale', country, 30)
          setCookie('insound_currency', detected, 30)
        }
      } catch {}
    }
  }, [locale, currency])

  useEffect(() => {
    fetch('/api/exchange-rates')
      .then(r => r.json())
      .then(data => {
        if (data.rates) setExchangeRates(data.rates)
      })
      .catch(() => {})
  }, [])

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code)
    setCookie('insound_currency', code, 30)
    fetch('/api/fan-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_currency: code, locale }),
    }).catch(() => {})
  }, [locale])

  const formatPrice = useCallback(
    (amount: number, overrideCurrency?: string) =>
      formatPriceUtil(amount, overrideCurrency || currency, undefined),
    [currency],
  )

  const convertPrice = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string) =>
      convertPriceUtil(amount, fromCurrency, toCurrency, exchangeRates),
    [exchangeRates],
  )

  return (
    <CurrencyContext.Provider value={{ locale, currency, setCurrency, formatPrice, exchangeRates, convertPrice }}>
      {children}
    </CurrencyContext.Provider>
  )
}
```

- [ ] **Step 2: Update layout.tsx to wrap with CurrencyProvider**

Modify `app/layout.tsx`. The root layout is a server component, so it can read cookies and pass them as props:

```tsx
import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { cookies } from 'next/headers'
import { PlayerBar } from './components/PlayerBar'
import { CurrencyProvider } from './providers/CurrencyProvider'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

const themeScript = `(function(){var s=localStorage.getItem('insound_theme')||(window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');if(s==='light')document.documentElement.setAttribute('data-theme','light');})();`

export const metadata: Metadata = {
  title: 'insound. — Music That Pays Artists',
  description: 'The music platform that only takes 10%. Stripe processing shown transparently at checkout. No labels, no middlemen. Join the waitlist.',
  openGraph: {
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee. Join the waitlist.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
    images: [{ url: 'https://getinsound.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee. Join the waitlist.',
    images: ['https://getinsound.com/og-image.png'],
  },
  icons: { icon: '/favicon.svg' },
  alternates: { canonical: 'https://getinsound.com/' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialLocale = cookieStore.get('insound_locale')?.value || ''
  const initialCurrency = cookieStore.get('insound_currency')?.value || 'GBP'

  return (
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CurrencyProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
          {children}
        </CurrencyProvider>
        <PlayerBar />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify the dev server starts and pages render without errors**

Run: `npm run dev` and visit `http://localhost:3000`. Open React DevTools and confirm `CurrencyProvider` is in the component tree. Check the browser console for any errors.

- [ ] **Step 4: Commit**

```bash
git add app/providers/CurrencyProvider.tsx app/layout.tsx
git commit -m "feat: CurrencyProvider context with server-side cookie initialization and exchange rate fetching"
```

---

## Task 8: Currency Switcher Component + Footer Integration

**Files:**
- Create: `app/components/ui/CurrencySwitcher.tsx`
- Modify: `app/components/ui/Footer.tsx`

- [ ] **Step 1: Create the CurrencySwitcher component**

Create `app/components/ui/CurrencySwitcher.tsx`:

```tsx
'use client'

import { useCurrency } from '../../providers/CurrencyProvider'
import { SUPPORTED_CURRENCIES } from '../../lib/currency'

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4 text-zinc-500"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
          clipRule="evenodd"
        />
      </svg>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="bg-transparent text-xs font-semibold text-zinc-500 hover:text-zinc-300
          border border-zinc-800 rounded px-2 py-1 cursor-pointer
          focus:outline-none focus:border-[#F56D00] focus:text-zinc-200
          transition-colors appearance-none
          [html[data-theme=light]_&]:border-zinc-300
          [html[data-theme=light]_&]:text-zinc-600
          [html[data-theme=light]_&]:hover:text-zinc-900
          [html[data-theme=light]_&]:focus:border-[#F56D00]"
        aria-label="Select currency"
      >
        {SUPPORTED_CURRENCIES.map(({ code, label }) => (
          <option key={code} value={code} className="bg-zinc-900 text-zinc-200">
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Update Footer.tsx to include the CurrencySwitcher**

Replace the contents of `app/components/ui/Footer.tsx`:

```tsx
import { CurrencySwitcher } from './CurrencySwitcher'

type FooterLink = {
  label: string
  href: string
}

type Props = {
  links?: FooterLink[]
  className?: string
}

export function Footer({ links = [], className = '' }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className={`border-t border-white/[0.06] py-12 px-6
      [html[data-theme=light]_&]:border-zinc-200 ${className}`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <span className="font-display text-lg font-bold text-white
          [html[data-theme=light]_&]:text-zinc-900">
          insound
        </span>

        {links.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors
                  [html[data-theme=light]_&]:hover:text-zinc-700"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <CurrencySwitcher />
          <p className="text-xs text-zinc-600">&copy; {year} Insound. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Verify in browser**

Run dev server, scroll to footer on any page. Confirm:
- Globe icon and dropdown appear
- Dropdown shows all 6 currencies
- Changing currency updates the cookie (check Application → Cookies in DevTools)
- Selected value persists on page reload

- [ ] **Step 4: Commit**

```bash
git add app/components/ui/CurrencySwitcher.tsx app/components/ui/Footer.tsx
git commit -m "feat: currency switcher component in footer with globe icon and styled dropdown"
```

---

## Task 9: Update HomeClient.tsx Price Displays

**Files:**
- Modify: `app/components/HomeClient.tsx`

This is the largest file with 26+ hardcoded price references. The approach:
1. Import `useCurrency` hook
2. Replace the existing currency detection `useEffect` with context values
3. Replace all hardcoded `£` with `formatPrice()` calls
4. For static marketing copy (e.g., "On a £10 sale"), generate dynamic equivalents

- [ ] **Step 1: Add useCurrency import and replace currency detection**

At the top of `HomeClient.tsx`, add import:
```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Inside the component function, add near the top (after existing state declarations):
```typescript
const { currency, formatPrice, convertPrice, exchangeRates } = useCurrency()
```

Remove the existing `currSym` state and the currency detection `useEffect` (lines ~65 and ~217-234). Replace `currSym` usage with the context's `formatPrice`.

- [ ] **Step 2: Replace calculator price displays**

Find the calculator section. Replace hardcoded calculations with dynamic ones. For example:

Where you see `${currSym}${(calcPrice * 0.8).toFixed(2)}` (around line 298), replace with:
```typescript
const calcExample = currency === 'GBP' ? 10 : convertPrice(10, 'GBP', currency)
```

And use `formatPrice(calcExample)` instead of hardcoded `£10`.

For the breakdown display (around lines 507-520), replace:
```tsx
// Before: £8.65 hardcoded
// After:
const examplePrice = convertPrice(10, 'GBP', currency)
const exampleFees = calculateFees(examplePrice)
```

- [ ] **Step 3: Replace all remaining hardcoded £ references**

Go through each hardcoded reference. For marketing copy that uses specific GBP amounts as examples:

| Line | Before | After |
|------|--------|-------|
| ~441 | `£0` | `formatPrice(0)` |
| ~485 | `£2,000 – £8,000+` | `{formatPrice(convertPrice(2000, 'GBP', currency))} – {formatPrice(convertPrice(8000, 'GBP', currency))}+` |
| ~492 | `£0 to publish` | `{formatPrice(0)} to publish` |
| ~507 | `A fan spends £10` | `A fan spends {formatPrice(convertPrice(10, 'GBP', currency))}` |
| ~512 | `£8.65` | `{formatPrice(convertPrice(8.65, 'GBP', currency))}` |
| ~516 | `£1.00` | `{formatPrice(convertPrice(1, 'GBP', currency))}` |
| ~543 | `~£0.003 per stream` | `~{formatPrice(convertPrice(0.003, 'GBP', currency))} per stream` |
| ~554 | `~112 sales at £10` | `~112 sales at {formatPrice(convertPrice(10, 'GBP', currency))}` |
| ~681 | `£1,000` | `{formatPrice(convertPrice(1000, 'GBP', currency))}` |
| ~724 | `£` symbol | Use `formatPrice` for the value |
| ~728 | `Minimum £2` | `Minimum {formatPrice(convertPrice(2, 'GBP', currency))}` |
| ~791 | `£7.20` | `{formatPrice(convertPrice(7.20, 'GBP', currency))}` |
| ~798 | `£247.50` | `{formatPrice(convertPrice(247.50, 'GBP', currency))}` |
| ~877 | `£${track.price}` | `{formatPrice(parseFloat(track.price))}` |
| ~905,910 | `On a £10 sale: £8.65 to you...` | Dynamic version with `convertPrice` |

For the phone mockup track prices (line ~877), the mock data is already in GBP. Convert for display:
```tsx
formatPrice(convertPrice(parseFloat(track.price), 'GBP', currency))
```

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:3000`. Change currency in footer. Confirm:
- Calculator updates to show prices in selected currency
- All stat cards show converted amounts
- Breakdown section shows correct converted amounts
- No hardcoded `£` symbols remain visible when currency is not GBP

- [ ] **Step 5: Commit**

```bash
git add app/components/HomeClient.tsx
git commit -m "feat: replace all hardcoded GBP prices on homepage with dynamic currency formatting"
```

---

## Task 10: Update WhyUsClient.tsx Price Displays

**Files:**
- Modify: `app/why-us/WhyUsClient.tsx`

- [ ] **Step 1: Add imports and hook**

At the top of the component, add:
```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Inside the component:
```typescript
const { currency, formatPrice, convertPrice } = useCurrency()
```

- [ ] **Step 2: Replace all 12 hardcoded £ references**

| Line | Before | After |
|------|--------|-------|
| ~120 | `£0` | `{formatPrice(0)}` |
| ~135 | `£{price}` (from slider) | `{formatPrice(convertPrice(price, 'GBP', currency))}` |
| ~148 | `£5 min` | `{formatPrice(convertPrice(5, 'GBP', currency))} min` |
| ~149 | `£100 max` | `{formatPrice(convertPrice(100, 'GBP', currency))} max` |
| ~164 | `£43.99` | `{formatPrice(convertPrice(43.99, 'GBP', currency))}` |
| ~168 | `£0.0031` | `{formatPrice(convertPrice(0.0031, 'GBP', currency))}` |
| ~176 | `£{profit.toFixed(2)}` | `{formatPrice(convertPrice(profit, 'GBP', currency))}` |
| ~194 | `£43.99 distribution fee` | `{formatPrice(convertPrice(43.99, 'GBP', currency))} distribution fee` |
| ~221 | `£0.00` | `{formatPrice(0)}` |
| ~222 | `£43.99` | `{formatPrice(convertPrice(43.99, 'GBP', currency))}` |
| ~237 | `£1.50` | `{formatPrice(convertPrice(1.50, 'GBP', currency))}` |
| ~242 | `£10.00+` | `{formatPrice(convertPrice(10, 'GBP', currency))}+` |

- [ ] **Step 3: Verify and commit**

Visit `/why-us`, change currency, confirm all prices update.

```bash
git add app/why-us/WhyUsClient.tsx
git commit -m "feat: dynamic currency formatting on /why-us page"
```

---

## Task 11: Update ForArtistsClient.tsx Price Displays

**Files:**
- Modify: `app/for-artists/ForArtistsClient.tsx`

- [ ] **Step 1: Add imports and hook**

```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Inside the component:
```typescript
const { currency, formatPrice, convertPrice } = useCurrency()
```

- [ ] **Step 2: Replace all 8 hardcoded £ references**

| Line | Before | After |
|------|--------|-------|
| ~11 | `'£0'` | `formatPrice(0)` |
| ~12 | `'£2'` | `formatPrice(convertPrice(2, 'GBP', currency))` |
| ~18 | `'£2 minimum...'` | Template literal with `formatPrice(convertPrice(2, 'GBP', currency))` |
| ~25 | `'~£0.003 per stream. 333,000+ to earn £1,000.'` | Template literal with `formatPrice` calls |
| ~37 | `'~£0.003 per stream'` | Template literal with `formatPrice` |
| ~38 | `'333,000+ streams'` / `'~112 sales at £10'` | Template literal with `formatPrice` |
| ~74 | FAQ answer with `£10`, `£8.65`, etc. | Template literal with `formatPrice` calls |
| ~78 | `'£2'` in FAQ | Template literal with `formatPrice` |

- [ ] **Step 3: Verify and commit**

Visit `/for-artists`, change currency, confirm all prices update.

```bash
git add app/for-artists/ForArtistsClient.tsx
git commit -m "feat: dynamic currency formatting on /for-artists page"
```

---

## Task 12: Update ForFansClient.tsx + ForPress Price Displays

**Files:**
- Modify: `app/for-fans/ForFansClient.tsx`
- Modify: `app/for-fans/page.tsx`
- Modify: `app/for-press/ForPressClient.tsx`

- [ ] **Step 1: Update ForFansClient.tsx**

Add imports and hook (same pattern as above). Replace all 7 hardcoded £ references:

| Line | Before | After |
|------|--------|-------|
| ~60 | `Your £10 can change...` | `Your {formatPrice(convertPrice(10, 'GBP', currency))} can change...` |
| ~74 | `£0.003` | `{formatPrice(convertPrice(0.003, 'GBP', currency))}` |
| ~75 | `earn £1,000` | `earn {formatPrice(convertPrice(1000, 'GBP', currency))}` |
| ~81 | `Your £10 = £8.65 to the artist` | Dynamic version |
| ~93 | `Your £10` | Dynamic version |
| ~101 | `£8.65` | `{formatPrice(convertPrice(8.65, 'GBP', currency))}` |
| ~105 | `£1.00` | `{formatPrice(convertPrice(1, 'GBP', currency))}` |

- [ ] **Step 2: Update page.tsx metadata**

The meta description in `app/for-fans/page.tsx` line 6 has `'Your £10 can change...'`. Since metadata is server-rendered and doesn't have access to the client currency context, keep this as GBP — it's SEO content and should remain in the base currency.

No change needed.

- [ ] **Step 3: Update ForPressClient.tsx**

Add imports and hook. Replace:

| Line | Before | After |
|------|--------|-------|
| ~13 | `'£2'` | `formatPrice(convertPrice(2, 'GBP', currency))` |

- [ ] **Step 4: Verify and commit**

Visit `/for-fans` and `/for-press`, change currency, confirm.

```bash
git add app/for-fans/ForFansClient.tsx app/for-press/ForPressClient.tsx
git commit -m "feat: dynamic currency formatting on /for-fans and /for-press pages"
```

---

## Task 13: Update Artist Profile & Fan Profile Price Displays

**Files:**
- Modify: `app/[slug]/ArtistProfileClient.tsx`
- Modify: `app/[slug]/FanProfileClient.tsx`

- [ ] **Step 1: Update ArtistProfileClient.tsx**

Add imports and hook. These prices come from the database (`release.price_pence`, `release.currency`), so we convert from the artist's currency to the fan's currency:

```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Replace the price display logic around lines 100-102:

```typescript
// Before:
// return { label: `from £${(min / 100).toFixed(2)}`, sub: 'or more' }
// return { label: `£${(release.price_pence / 100).toFixed(2)}`, sub: null }

// After:
const { currency, formatPrice, convertPrice } = useCurrency()

// In the price display function:
const artistCurrency = release.currency || 'GBP'
const priceInArtistCurrency = release.price_pence / 100
const priceInFanCurrency = convertPrice(priceInArtistCurrency, artistCurrency, currency)

// For PWYW:
return { label: `from ${formatPrice(convertPrice(min / 100, artistCurrency, currency))}`, sub: 'or more' }

// For fixed price:
return { label: formatPrice(priceInFanCurrency), sub: null }
```

If the artist's currency differs from the fan's, show a muted conversion note:
```tsx
{artistCurrency !== currency && (
  <span className="text-[10px] text-zinc-600">
    ({formatPrice(priceInArtistCurrency, artistCurrency)})
  </span>
)}
```

- [ ] **Step 2: Update FanProfileClient.tsx**

Add imports and hook. Replace line ~574:

```typescript
// Before:
// <p className="text-[10px] text-zinc-600 mt-2">&pound;{(purchase.amount_pence / 100).toFixed(2)}</p>

// After:
<p className="text-[10px] text-zinc-600 mt-2">
  {formatPrice(purchase.amount_pence / 100, purchase.fan_currency || 'GBP')}
</p>
```

- [ ] **Step 3: Verify and commit**

Visit an artist profile page and a fan profile page. Confirm prices display in the fan's selected currency with conversion notes where applicable.

```bash
git add app/[slug]/ArtistProfileClient.tsx app/[slug]/FanProfileClient.tsx
git commit -m "feat: dynamic currency formatting on artist and fan profile pages"
```

---

## Task 14: Update Explore Page Price Displays

**Files:**
- Modify: `app/explore/ExploreClient.tsx`

- [ ] **Step 1: Add imports and hook**

```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Inside the component:
```typescript
const { currency, formatPrice, convertPrice } = useCurrency()
```

- [ ] **Step 2: Replace hardcoded price displays**

The explore page uses mock data with GBP prices. Replace all 4 display locations:

| Line | Before | After |
|------|--------|-------|
| ~577 | `&pound;{artistShare.toFixed(2)}` | `{formatPrice(convertPrice(artistShare, 'GBP', currency))}` |
| ~581 | `&pound;{cartTotal.toFixed(2)}` | `{formatPrice(convertPrice(cartTotal, 'GBP', currency))}` |

Also update the checkout calculation (line ~241) to use the region-aware fee function when available. For now, since this is mock data, just update the display formatting.

For track prices in the grid, convert the mock GBP prices:
```tsx
{formatPrice(convertPrice(parseFloat(track.price), 'GBP', currency))}
```

- [ ] **Step 3: Verify and commit**

Visit `/explore`, change currency, confirm prices update.

```bash
git add app/explore/ExploreClient.tsx
git commit -m "feat: dynamic currency formatting on explore page"
```

---

## Task 15: Update Release/Checkout Page

**Files:**
- Modify: `app/release/ReleaseClient.tsx`

This is the most important page — the actual checkout flow. It needs to show the full multi-currency fee breakdown.

- [ ] **Step 1: Add imports**

```typescript
import { useCurrency } from '../providers/CurrencyProvider'
import { calculateStripeFee } from '../lib/fees'
import { getRegion } from '../lib/currency'
```

Inside the component:
```typescript
const { locale, currency, formatPrice, convertPrice, exchangeRates } = useCurrency()
```

- [ ] **Step 2: Replace all price displays (11 locations)**

Replace the `pence()` helper and all `&pound;` entities. The key change is the checkout summary section:

```tsx
// Calculate fees with region awareness
const artistCurrency = release.currency || 'GBP'
const priceInArtistCurrency = release.price_pence / 100
const priceInFanCurrency = convertPrice(priceInArtistCurrency, artistCurrency, currency)
const fees = calculateStripeFee(priceInArtistCurrency, locale, artistRegion, currency, artistCurrency)

// Display:
// Price:                    {formatPrice(priceInFanCurrency)}
// Stripe processing fee:    {formatPrice(convertPrice(fees.stripeFee + fees.internationalFee, artistCurrency, currency))}
// Currency conversion fee:  {formatPrice(convertPrice(fees.conversionFee, artistCurrency, currency))} (only if > 0)
// Insound fee (10%):        {formatPrice(convertPrice(fees.insoundFee, artistCurrency, currency))}
// ─────────────────────────
// Artist receives:          {formatPrice(fees.artistReceived, artistCurrency)}
```

Replace all specific locations:

| Line | Before | After |
|------|--------|-------|
| ~397 | `(release.price_pence / 100).toFixed(2)` | `priceInFanCurrency` variable |
| ~401 | `(minPence / 100).toFixed(2)` | `formatPrice(convertPrice(minPence / 100, artistCurrency, currency))` |
| ~407 | `artistGetsPence / 100` | `fees.artistReceived` |
| ~415 | `&pound;` entity | Remove — use `formatPrice()` which includes symbol |
| ~426 | `&pound;{minPounds}` | `{formatPrice(convertPrice(minPence / 100, artistCurrency, currency))}` |
| ~430 | `&pound;{defaultPounds}` | `{formatPrice(priceInFanCurrency)}` |
| ~436 | `&pound;{artistGets} goes to the artist` | `{formatPrice(fees.artistReceived, artistCurrency)} goes to the artist` |
| ~441 | `&pound;{minPounds}` | `{formatPrice(convertPrice(minPence / 100, artistCurrency, currency))}` |
| ~451 | `&pound;{...}` | `{formatPrice(priceInFanCurrency)}` |

Add conversion note when currencies differ:
```tsx
{artistCurrency !== currency && (
  <p className="text-[10px] text-zinc-500 mt-1">
    {formatPrice(priceInArtistCurrency, artistCurrency)} converted at current rate
  </p>
)}
```

- [ ] **Step 3: Add the full fee breakdown display in the checkout modal**

After the buy button, in the checkout summary area, add:

```tsx
<div className="text-xs text-zinc-500 space-y-1 mt-4">
  <div className="flex justify-between">
    <span>Price</span>
    <span>{formatPrice(priceInFanCurrency)}</span>
  </div>
  <div className="flex justify-between">
    <span>Stripe processing</span>
    <span>{formatPrice(convertPrice(fees.stripeFee + fees.internationalFee, artistCurrency, currency))}</span>
  </div>
  {fees.conversionFee > 0 && (
    <div className="flex justify-between">
      <span>Currency conversion</span>
      <span>{formatPrice(convertPrice(fees.conversionFee, artistCurrency, currency))}</span>
    </div>
  )}
  <div className="flex justify-between">
    <span>Insound fee (10%)</span>
    <span>{formatPrice(convertPrice(fees.insoundFee, artistCurrency, currency))}</span>
  </div>
  <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1 text-zinc-300">
    <span>Artist receives</span>
    <span>{formatPrice(fees.artistReceived, artistCurrency)}</span>
  </div>
  {artistCurrency !== currency && (
    <p className="text-[10px] text-zinc-600 mt-2">
      You'll be charged {currency}. Artist receives {artistCurrency}.
    </p>
  )}
</div>
```

- [ ] **Step 4: Verify in browser**

Navigate to a release page. Confirm:
- Price displays in fan's selected currency
- Fee breakdown shows all line items
- Artist receives shown in artist's currency
- Conversion note appears when currencies differ
- Switching currency in footer updates the display

- [ ] **Step 5: Commit**

```bash
git add app/release/ReleaseClient.tsx
git commit -m "feat: multi-currency checkout display with full fee breakdown and conversion notes"
```

---

## Task 16: Update Dashboard & Sales Pages

**Files:**
- Modify: `app/dashboard/DashboardClient.tsx`
- Modify: `app/sales/SalesClient.tsx`

- [ ] **Step 1: Update DashboardClient.tsx**

Add imports. The dashboard should show all values in the **artist's** currency (not the fan's selected currency). The artist's `default_currency` should be fetched from the database alongside other artist data.

Replace the `pence()` helper function (line ~33):

```typescript
// Before:
// function pence(n: number) { return `£${(n / 100).toFixed(2)}` }

// After:
import { formatPrice as formatPriceUtil } from '../lib/currency'

// Inside component, after fetching artist data:
const artistCurrency = artist?.default_currency || 'GBP'
function pence(n: number) { return formatPriceUtil(n / 100, artistCurrency) }
```

This is a minimal change that replaces the hardcoded `£` while keeping the same helper pattern. All existing calls to `pence()` continue to work.

If the dashboard fetches artist data (e.g., from Supabase), ensure the query includes `default_currency` in the select:
```typescript
.select('id, name, slug, ..., default_currency')
```

- [ ] **Step 2: Update SalesClient.tsx**

Add imports. Replace all 9 hardcoded `&pound;` references:

```typescript
import { formatPrice as formatPriceUtil } from '../lib/currency'

// Inside component:
const artistCurrency = artist?.default_currency || 'GBP'
const fp = (n: number) => formatPriceUtil(n, artistCurrency)
```

| Line | Before | After |
|------|--------|-------|
| ~77 | `&pound;0.00` | `{fp(0)}` |
| ~86 | `&pound;0.00` | `{fp(0)}` |
| ~103 | `&pound;0 total` | `{fp(0)} total` |
| ~111 | `&pound;0.00` | `{fp(0)}` |
| ~115 | `Amount to Withdraw (&pound;)` | `Amount to Withdraw ({artistCurrency})` |
| ~117 | `&pound;` input prefix | Currency symbol from `SUPPORTED_CURRENCIES.find(c => c.code === artistCurrency)?.symbol` |
| ~150 | `&pound;0.00 → Your bank account` | `{fp(0)} → Your bank account` |

- [ ] **Step 3: Verify and commit**

Visit `/dashboard` and `/sales` as an artist. Confirm all amounts show in the artist's default currency.

```bash
git add app/dashboard/DashboardClient.tsx app/sales/SalesClient.tsx
git commit -m "feat: dynamic currency formatting on dashboard and sales pages using artist's default currency"
```

---

## Task 17: Update Discography, Library, and PayWhatYouWant

**Files:**
- Modify: `app/discography/DiscographyClient.tsx`
- Modify: `app/library/LibraryClient.tsx`
- Modify: `app/components/ui/PayWhatYouWant.tsx`

- [ ] **Step 1: Update DiscographyClient.tsx**

Replace the `pence()` helper (line ~67) with the same pattern as DashboardClient:

```typescript
import { formatPrice as formatPriceUtil } from '../lib/currency'

// The discography page is artist-facing, so use artist's currency:
const artistCurrency = artist?.default_currency || 'GBP'
function pence(n: number) { return formatPriceUtil(n / 100, artistCurrency) }
```

Replace the hardcoded error message (line ~186):
```typescript
// Before: setError('Minimum price is £2.00.')
// After:
setError(`Minimum price is ${formatPriceUtil(2, artistCurrency)}.`)
```

Replace hardcoded labels (lines ~522, ~532, ~545):
```tsx
// Before: <label>Price (£)</label>
// After:
<label>Price ({SUPPORTED_CURRENCIES.find(c => c.code === artistCurrency)?.symbol || '£'})</label>
```

- [ ] **Step 2: Update LibraryClient.tsx**

Add the currency hook (this is fan-facing, so use fan's currency):

```typescript
import { useCurrency } from '../providers/CurrencyProvider'
```

Inside component:
```typescript
const { formatPrice } = useCurrency()
```

Replace the total contributed display (line ~61) with `formatPrice()`.

- [ ] **Step 3: Update PayWhatYouWant.tsx**

Change the default prop from hardcoded `'£'`:

```typescript
// Before: currency = '£'
// After: currency = '£' (keep as default prop, but callers should pass the correct symbol)
```

Actually, refactor to accept a currency code instead of a symbol:

```typescript
// Before:
// currency = '£'

// After — accept currencyCode and use formatPrice internally:
import { formatPrice } from '../../lib/currency'

interface Props {
  minPence: number
  currencyCode?: string
  onConfirm: (pence: number) => void
}

export function PayWhatYouWant({ minPence, currencyCode = 'GBP', onConfirm }: Props) {
  // ... existing logic, but use formatPrice(value, currencyCode) for display
}
```

Update all callers to pass `currencyCode` instead of `currency` symbol.

- [ ] **Step 4: Verify and commit**

Test the discography page (as artist), library page (as fan), and any PWYW flow.

```bash
git add app/discography/DiscographyClient.tsx app/library/LibraryClient.tsx app/components/ui/PayWhatYouWant.tsx
git commit -m "feat: dynamic currency formatting on discography, library, and PWYW component"
```

---

## Task 18: Update Checkout Edge Function

**Files:**
- Modify: `supabase/functions/checkout-create/index.ts`

- [ ] **Step 1: Accept fan_currency in the request body**

Update the edge function to accept `fan_currency` and use it as the Stripe checkout session currency. Stripe will handle the actual conversion.

In `supabase/functions/checkout-create/index.ts`, modify the request body parsing:

```typescript
// After line 36, add:
const fanCurrency: string | undefined = body.fan_currency;
const fanLocale: string | undefined = body.fan_locale;
```

Update the Stripe session creation (around line 84):

```typescript
// Before:
// currency: (release.currency || 'GBP').toLowerCase(),

// After — use fan's currency if provided, otherwise fall back to release currency:
currency: (fanCurrency || release.currency || 'GBP').toLowerCase(),
```

Add `fan_currency` and `fan_locale` to the session metadata so the webhook can record it:

```typescript
metadata: {
  release_id: release.id,
  artist_id: artist.id,
  fan_currency: fanCurrency || release.currency || 'GBP',
  fan_locale: fanLocale || '',
},
```

- [ ] **Step 2: Update the client-side checkout call**

In `app/release/ReleaseClient.tsx`, where `checkout-create` is invoked, add the fan's currency and locale:

Find the `supabase.functions.invoke('checkout-create', ...)` call and update the body:

```typescript
// Before:
// body: { release_id, origin }

// After:
body: {
  release_id: release.id,
  origin: window.location.origin,
  fan_currency: currency,   // from useCurrency()
  fan_locale: locale,        // from useCurrency()
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/checkout-create/index.ts app/release/ReleaseClient.tsx
git commit -m "feat: pass fan currency to Stripe checkout for multi-currency charging"
```

---

## Task 19: Sync Artist default_currency During Stripe Onboarding

**Files:**
- Modify: `supabase/functions/connect-onboard/index.ts`

- [ ] **Step 1: Update the onboarding function to sync default_currency**

In `supabase/functions/connect-onboard/index.ts`, after retrieving the Stripe account (line 77), read `stripeAccount.default_currency` and sync it to the `artists` table.

After line 88 (the `stripe_onboarded` update), add:

```typescript
// Sync Stripe's default currency to the artists table
const stripeCurrency = (stripeAccount.default_currency || 'gbp').toUpperCase()
await admin
  .from('artists')
  .update({ default_currency: stripeCurrency })
  .eq('id', user.id);
```

This runs every time the onboarding function is called (it refreshes status on every call), so the currency will stay in sync even if the artist changes their Stripe settings.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/connect-onboard/index.ts
git commit -m "feat: sync artist default_currency from Stripe account during onboarding"
```

---

## Task 20: Final Integration Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-cache
```

Expected: All tests pass.

- [ ] **Step 2: Run the dev server and test the three scenarios**

Start: `npm run dev`

**Test 1: UK fan buying from UK artist**
- Set currency to GBP via footer switcher
- Navigate to a UK artist's release
- Confirm: price in GBP, no conversion fee, base rate 1.5% + £0.20
- Click buy, confirm Stripe checkout loads in GBP

**Test 2: US fan buying from UK artist**
- Set currency to USD via footer switcher
- Navigate to a UK artist's release
- Confirm: price shown in USD with "(approximately £X.XX)" note
- Fee breakdown shows international surcharge + conversion fee
- Artist receives shown in GBP

**Test 3: EU fan buying from US artist**
- Set currency to EUR via footer switcher
- Navigate to a US artist's release (if available, or test with mock)
- Confirm: price in EUR, different base rate (2.9% + $0.30), conversion fee shown

- [ ] **Step 3: Verify cookie persistence**

1. Set currency to JPY
2. Close and reopen the browser tab
3. Confirm JPY is still selected
4. Prices should show with ¥ and no decimal places

- [ ] **Step 4: Verify all pages render without errors**

Visit each page and confirm no console errors:
- `/` (homepage)
- `/for-artists`
- `/for-fans`
- `/for-press`
- `/why-us`
- `/explore`
- `/dashboard` (as artist)
- `/sales` (as artist)
- `/library` (as fan)
- An artist profile page (`/[slug]`)
- A fan profile page
- A release page

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: Build succeeds with no type errors (note: `ignoreBuildErrors: true` is set, but aim for zero errors anyway).

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes from multi-currency testing"
```
