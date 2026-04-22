-- 0016_multi_currency.sql
-- Adds multi-currency support: artist default currency, expanded release currencies,
-- fan currency preference columns, and purchase currency tracking.

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

-- 4. Add display_currency and locale to existing fan_preferences table
--    (fan_preferences already exists as a genre-preference table from 0009)
ALTER TABLE public.fan_preferences
  ADD COLUMN IF NOT EXISTS display_currency text,
  ADD COLUMN IF NOT EXISTS locale           text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- 5. Add fan currency columns to purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS fan_currency text,
  ADD COLUMN IF NOT EXISTS fan_amount   integer;
