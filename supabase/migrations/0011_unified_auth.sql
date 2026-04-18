-- 0011_unified_auth.sql
-- Unified auth: every signup creates a fan_profiles row.
-- Artist rows are created explicitly during the upgrade flow.

-- 1. Add new columns to fan_profiles
alter table public.fan_profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists accent_colour text,
  add column if not exists is_public boolean not null default true,
  add column if not exists show_purchase_amounts boolean not null default false,
  add column if not exists has_seen_welcome boolean not null default false;

-- 2. Replace the auth trigger to create fan_profiles (not artists)
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fan_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Add default_currency to artists table for the upgrade flow
alter table public.artists
  add column if not exists default_currency text not null default 'GBP';
