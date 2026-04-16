-- Add PWYW, pre-order, and visibility controls to releases.
-- Also add download_codes table for batch code management.

-- PWYW: pay-what-you-want with a minimum
alter table public.releases
  add column if not exists pwyw_enabled boolean not null default false,
  add column if not exists pwyw_minimum_pence integer check (pwyw_minimum_pence is null or pwyw_minimum_pence >= 0);

-- Pre-order
alter table public.releases
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists release_date date;

-- Visibility: public (in explore + search), unlisted (direct link only), private (owner only)
alter table public.releases
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private'));

-- Play counts
alter table public.tracks
  add column if not exists preview_plays integer not null default 0,
  add column if not exists full_plays integer not null default 0;

-- Download codes: batch-generated promo codes per release
create table public.download_codes (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references public.releases(id) on delete cascade,
  artist_id   uuid not null references public.artists(id) on delete cascade,
  code        text unique not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index download_codes_release_idx on public.download_codes(release_id);
create index download_codes_code_idx on public.download_codes(code);

alter table public.download_codes enable row level security;

-- Artist can see and manage their own codes
create policy download_codes_select_own on public.download_codes
  for select using ((select auth.uid()) = artist_id);
create policy download_codes_insert_own on public.download_codes
  for insert with check ((select auth.uid()) = artist_id);
create policy download_codes_delete_own on public.download_codes
  for delete using ((select auth.uid()) = artist_id);

-- Update RLS on releases to respect visibility
-- Drop old published-only read policy and replace with visibility-aware one
drop policy if exists releases_read_published on public.releases;

create policy releases_read_visible on public.releases
  for select using (
    (select auth.uid()) = artist_id  -- owner always sees
    or (published and visibility = 'public')  -- everyone sees public+published
    or (published and visibility = 'unlisted')  -- unlisted is visible if you have the link (no filtering in explore)
  );
