-- 0043_founding_artist_programme.sql
-- Replace zero-fees referral feature with bounded Founding Artist programme.
-- Reversible: see DOWN MIGRATION section at bottom.

begin;

-- ============================================================
-- 1. NEW COLUMNS ON artists TABLE
-- ============================================================

alter table public.artists
  add column if not exists founding_artist boolean not null default false,
  add column if not exists founding_artist_confirmed_at timestamptz,
  add column if not exists founding_artist_first_sale_at timestamptz;

-- ============================================================
-- 2. PROGRAMME SETTINGS TABLE
-- ============================================================

create table if not exists public.founding_artist_programme (
  id integer primary key default 1 check (id = 1),
  total_spots integer not null default 50,
  filled_count integer not null default 0,
  paused boolean not null default false
);

insert into public.founding_artist_programme (id, total_spots, filled_count, paused)
values (1, 50, 0, false)
on conflict (id) do nothing;

alter table public.founding_artist_programme enable row level security;

-- Admins can read and update programme settings
create policy founding_artist_programme_admin_select
  on public.founding_artist_programme for select
  using (exists (select 1 from public.fan_profiles where id = auth.uid() and is_admin = true));

create policy founding_artist_programme_admin_update
  on public.founding_artist_programme for update
  using (exists (select 1 from public.fan_profiles where id = auth.uid() and is_admin = true));

-- ============================================================
-- 3. RPC: atomically confirm a Founding Artist
-- ============================================================

create or replace function public.confirm_founding_artist(artist_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_filled integer;
  is_paused boolean;
  total integer;
  already boolean;
begin
  -- Lock the programme row to prevent races
  select filled_count, paused, total_spots
  into current_filled, is_paused, total
  from public.founding_artist_programme
  where id = 1
  for update;

  if is_paused then return false; end if;
  if current_filled >= total then return false; end if;

  -- Check not already confirmed
  select founding_artist into already
  from public.artists where id = artist_id;

  if already then return false; end if;

  -- Confirm
  update public.artists
  set founding_artist = true,
      founding_artist_confirmed_at = now()
  where id = artist_id;

  update public.founding_artist_programme
  set filled_count = filled_count + 1
  where id = 1;

  -- Award badge if not already present
  insert into public.fan_badges (user_id, badge_type, metadata)
  select artist_id, 'founding_artist', jsonb_build_object('programme', 'founding_artist_2026')
  where not exists (
    select 1 from public.fan_badges
    where user_id = artist_id and badge_type = 'founding_artist'
  );

  return true;
end;
$$;

-- ============================================================
-- 4. RPC: get Founding Artist fee info for checkout
-- ============================================================

create or replace function public.get_founding_artist_fee(p_artist_id uuid)
returns table(is_founding boolean, first_sale_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select founding_artist, founding_artist_first_sale_at
  from public.artists
  where id = p_artist_id;
$$;

-- ============================================================
-- 5. RPC: record first sale timestamp for Founding Artist
-- ============================================================

create or replace function public.set_founding_artist_first_sale(
  p_artist_id uuid,
  p_sale_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.artists
  set founding_artist_first_sale_at = p_sale_at
  where id = p_artist_id
    and founding_artist = true
    and founding_artist_first_sale_at is null;
$$;

-- ============================================================
-- 6. DEPRECATE old zero-fees trigger (disable body, keep shell)
-- ============================================================

-- Disable inherit_zero_fees trigger body — no longer propagates zero fees
create or replace function private.inherit_zero_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- DEPRECATED: zero-fees referral feature retired 2026-04-27.
  -- Trigger shell kept for rollback safety. Body is a no-op.
  return new;
end;
$$;

-- ============================================================
-- 7. DEPRECATE old zero-fees columns (mark only, do not drop)
-- ============================================================
-- Columns left in place for rollback safety:
--   artists.first_year_zero_fees
--   artists.first_year_zero_fees_start
--   fan_profiles.first_year_zero_fees
--   fan_profiles.first_year_zero_fees_unlocked_at
--   fan_profiles.referral_count
-- These columns are no longer read or written by application code.

comment on column public.artists.first_year_zero_fees is
  'DEPRECATED 2026-04-27: zero-fees referral retired. Replaced by founding_artist column.';
comment on column public.artists.first_year_zero_fees_start is
  'DEPRECATED 2026-04-27: zero-fees referral retired. Replaced by founding_artist_first_sale_at column.';
comment on column public.fan_profiles.first_year_zero_fees is
  'DEPRECATED 2026-04-27: zero-fees referral retired.';
comment on column public.fan_profiles.first_year_zero_fees_unlocked_at is
  'DEPRECATED 2026-04-27: zero-fees referral retired.';

-- ============================================================
-- 8. RETROACTIVE: confirm existing qualifying artists
-- ============================================================
-- An artist qualifies if:
--   - artist_accounts.stripe_verified = true (Stripe Connect verified)
--   - At least one published release exists

do $$
declare
  r record;
  confirmed_count integer := 0;
begin
  for r in
    select a.id
    from public.artists a
    join public.artist_accounts aa on aa.id = a.id
    where aa.stripe_verified = true
      and a.founding_artist = false
      and exists (
        select 1 from public.releases rel
        where rel.artist_id = a.id and rel.published = true
      )
    order by a.created_at asc
  loop
    -- Use the same atomic RPC logic
    if (select public.confirm_founding_artist(r.id)) then
      confirmed_count := confirmed_count + 1;
    end if;

    -- Stop if we've filled all spots
    exit when confirmed_count >= 50;
  end loop;

  raise notice 'Founding Artist backfill: confirmed % artists', confirmed_count;
end;
$$;

-- Also insert fan_badges for newly confirmed founding artists who don't already have one
insert into public.fan_badges (user_id, badge_type, metadata)
select
  a.id,
  'founding_artist',
  jsonb_build_object('programme', 'founding_artist_2026')
from public.artists a
where a.founding_artist = true
  and not exists (
    select 1 from public.fan_badges fb
    where fb.user_id = a.id and fb.badge_type = 'founding_artist'
  );

commit;

-- ============================================================
-- DOWN MIGRATION (run manually if rollback needed)
-- ============================================================
-- begin;
--
-- -- Restore inherit_zero_fees trigger
-- create or replace function private.inherit_zero_fees()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- begin
--   update public.artists
--   set first_year_zero_fees = true
--   where id = new.id
--     and exists (
--       select 1 from public.fan_profiles
--       where id = new.id and first_year_zero_fees = true
--     );
--   return new;
-- end;
-- $$;
--
-- -- Drop new columns
-- alter table public.artists
--   drop column if exists founding_artist,
--   drop column if exists founding_artist_confirmed_at,
--   drop column if exists founding_artist_first_sale_at;
--
-- -- Drop programme table
-- drop table if exists public.founding_artist_programme;
--
-- -- Drop new RPCs
-- drop function if exists public.confirm_founding_artist(uuid);
-- drop function if exists public.get_founding_artist_fee(uuid);
-- drop function if exists public.set_founding_artist_first_sale(uuid, timestamptz);
--
-- -- Remove column comments
-- comment on column public.artists.first_year_zero_fees is null;
-- comment on column public.artists.first_year_zero_fees_start is null;
-- comment on column public.fan_profiles.first_year_zero_fees is null;
-- comment on column public.fan_profiles.first_year_zero_fees_unlocked_at is null;
--
-- commit;
