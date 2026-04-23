-- 0026_rate_limits.sql
-- Generalized rate limiting table replacing signup_rate_limit.

-- ============================================================
-- 1. NEW RATE_LIMITS TABLE
-- ============================================================

create type public.rate_limit_action as enum (
  'magic_link', 'purchase', 'signup', 'redeem_code', 'social_verify', 'email_change'
);

create table public.rate_limits (
  id uuid default gen_random_uuid() primary key,
  key text not null,
  action public.rate_limit_action not null,
  created_at timestamptz not null default now()
);

create index rate_limits_lookup on public.rate_limits (key, action, created_at);

alter table public.rate_limits enable row level security;
-- No public access — service_role only

-- ============================================================
-- 2. CHECK_RATE_LIMIT RPC
-- ============================================================

create or replace function public.check_rate_limit(
  p_key text,
  p_action public.rate_limit_action,
  p_max integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.rate_limits
  where key = p_key
    and action = p_action
    and created_at > now() - p_window;

  if recent_count >= p_max then
    return false;
  end if;

  insert into public.rate_limits (key, action) values (p_key, p_action);

  -- Cleanup old entries
  delete from public.rate_limits
  where created_at < now() - interval '24 hours';

  return true;
end;
$$;

-- ============================================================
-- 3. MIGRATE EXISTING DATA & DROP OLD TABLE
-- ============================================================

insert into public.rate_limits (key, action, created_at)
select ip_hash, 'signup'::public.rate_limit_action, created_at
from public.signup_rate_limit;

drop function if exists public.check_signup_rate(text);
drop table if exists public.signup_rate_limit;
