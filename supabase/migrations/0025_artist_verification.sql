-- Tier 1: Stripe verification flag on artist_accounts
alter table public.artist_accounts
  add column if not exists stripe_verified boolean not null default false,
  add column if not exists stripe_verified_at timestamptz;

-- Tier 2: Social links as JSONB on artists (public-facing data)
alter table public.artists
  add column if not exists social_links jsonb;
