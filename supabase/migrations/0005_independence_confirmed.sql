-- Add explicit independence confirmation with timestamp.
-- Replaces the weaker self_attest_independent boolean.

alter table public.artist_accounts
  add column if not exists independence_confirmed boolean not null default false,
  add column if not exists independence_confirmed_at timestamptz;
