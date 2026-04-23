-- 0016_multi_currency.sql
-- Adds multi-currency support: artist default currency, expanded release currencies,
-- fan display currency on fan_profiles, and purchase currency tracking.

-- 1. Add default_currency to artists
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'GBP';

-- 2. Remove GBP-only constraint on releases
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_currency_check;

-- 3. Add expanded currency constraint
ALTER TABLE public.releases
  ADD CONSTRAINT releases_currency_check
  CHECK (currency IN ('GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY'));

-- 4. Add display_currency and locale to fan_profiles (1:1 per user)
ALTER TABLE public.fan_profiles
  ADD COLUMN IF NOT EXISTS display_currency text DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS locale text;

-- 5. Add fan currency columns to purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS fan_currency text,
  ADD COLUMN IF NOT EXISTS fan_amount integer;
