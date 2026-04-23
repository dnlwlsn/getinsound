-- 0015_referral_system.sql
-- Viral referral system: referral codes, tracking, zero-fees reward.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. FAN_PROFILES: referral columns
-- ============================================================

alter table public.fan_profiles
  add column if not exists referral_code text,
  add column if not exists referred_by text,
  add column if not exists referral_count integer not null default 0,
  add column if not exists first_year_zero_fees boolean not null default false,
  add column if not exists first_year_zero_fees_unlocked_at timestamptz;

create unique index if not exists fan_profiles_referral_code_unique
  on public.fan_profiles (referral_code) where referral_code is not null;

-- ============================================================
-- 2. ARTISTS: zero-fees columns
-- ============================================================

alter table public.artists
  add column if not exists first_year_zero_fees boolean not null default false,
  add column if not exists first_year_zero_fees_start timestamptz;

-- ============================================================
-- 3. GENERATE REFERRAL CODE ON USER CREATION
-- ============================================================

-- Safe charset: no 0/O/1/I/L
create or replace function private.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    -- Check uniqueness
    if not exists (select 1 from public.fan_profiles where referral_code = code) then
      return code;
    end if;
  end loop;
end;
$$;

-- Update auth trigger to assign referral code on signup
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fan_profiles (id, referral_code)
  values (new.id, private.generate_referral_code())
  on conflict (id) do update
    set referral_code = coalesce(public.fan_profiles.referral_code, excluded.referral_code);
  return new;
end;
$$;

-- Backfill referral codes for existing users who don't have one
do $$
declare
  r record;
begin
  for r in select id from public.fan_profiles where referral_code is null loop
    update public.fan_profiles
    set referral_code = private.generate_referral_code()
    where id = r.id;
  end loop;
end;
$$;

-- Now make it not null
alter table public.fan_profiles
  alter column referral_code set not null;

-- ============================================================
-- 4. RPC: atomic referral count increment + zero-fees unlock
-- ============================================================

create or replace function public.record_referral(
  referrer_code text,
  new_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_id uuid;
  new_count integer;
  referrer_email text;
  is_artist boolean;
begin
  -- Self-referral check: compare emails
  select fp.id into referrer_id
  from public.fan_profiles fp
  where fp.referral_code = referrer_code;

  if referrer_id is null then return false; end if;
  if referrer_id = new_user_id then return false; end if;

  -- Check email match (self-referral via alt code)
  perform 1
  from auth.users u1
  join auth.users u2 on lower(u1.email) = lower(u2.email)
  where u1.id = referrer_id and u2.id = new_user_id;
  if found then return false; end if;

  -- Set referred_by on the new user
  update public.fan_profiles
  set referred_by = referrer_code
  where id = new_user_id
    and referred_by is null;

  if not found then return false; end if;

  -- Atomic increment
  update public.fan_profiles
  set referral_count = referral_count + 1
  where id = referrer_id
  returning referral_count into new_count;

  -- Unlock zero fees at 5 referrals
  if new_count = 5 then
    update public.fan_profiles
    set first_year_zero_fees = true,
        first_year_zero_fees_unlocked_at = now()
    where id = referrer_id;

    -- If referrer is an artist, propagate
    update public.artists
    set first_year_zero_fees = true
    where id = referrer_id;

    return true;
  end if;

  return false;
end;
$$;

-- ============================================================
-- 5. SIGNUP RATE LIMITING TABLE
-- ============================================================

create table if not exists public.signup_rate_limit (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index signup_rate_limit_ip_time on public.signup_rate_limit(ip_hash, created_at);

alter table public.signup_rate_limit enable row level security;
-- No public access — service_role only

create or replace function public.check_signup_rate(ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  hashed text;
begin
  hashed := encode(digest(ip, 'sha256'), 'hex');

  select count(*) into recent_count
  from public.signup_rate_limit
  where ip_hash = hashed
    and created_at > now() - interval '1 hour';

  if recent_count >= 3 then
    return false;
  end if;

  insert into public.signup_rate_limit (ip_hash) values (hashed);

  -- Cleanup old entries periodically
  delete from public.signup_rate_limit where created_at < now() - interval '2 hours';

  return true;
end;
$$;

-- ============================================================
-- 6. TRIGGER: inherit zero-fees when becoming an artist
-- ============================================================

create or replace function private.inherit_zero_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.artists
  set first_year_zero_fees = true
  where id = new.id
    and exists (
      select 1 from public.fan_profiles
      where id = new.id and first_year_zero_fees = true
    );
  return new;
end;
$$;

create trigger inherit_zero_fees_on_artist_create
  after insert on public.artists
  for each row execute function private.inherit_zero_fees();

-- ============================================================
-- 7. RPC: check zero-fees eligibility for checkout
-- ============================================================

create or replace function public.get_artist_zero_fees(artist_id uuid)
returns table(zero_fees boolean, fees_start timestamptz)
language sql
security definer
set search_path = ''
as $$
  select first_year_zero_fees, first_year_zero_fees_start
  from public.artists
  where id = artist_id;
$$;

-- ============================================================
-- 8. RPC: set first sale date (called once on first sale)
-- ============================================================

create or replace function public.set_zero_fees_start(artist_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.artists
  set first_year_zero_fees_start = now()
  where id = artist_id
    and first_year_zero_fees = true
    and first_year_zero_fees_start is null;
$$;
