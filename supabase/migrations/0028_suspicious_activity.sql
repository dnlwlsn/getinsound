-- 0028_suspicious_activity.sql
-- Suspicious activity flagging and payout event tracking.

-- ============================================================
-- 1. FLAG TYPE ENUM & FLAGS TABLE
-- ============================================================

create type public.suspicious_flag_type as enum (
  'high_chargeback_rate', 'chargeback_volume', 'rapid_transactions', 'failed_payouts'
);

create table public.suspicious_activity_flags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_type public.suspicious_flag_type not null,
  details jsonb not null default '{}'::jsonb,
  reviewed boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index suspicious_flags_user on public.suspicious_activity_flags (user_id);
create index suspicious_flags_unreviewed on public.suspicious_activity_flags (reviewed) where reviewed = false;

alter table public.suspicious_activity_flags enable row level security;

-- ============================================================
-- 2. PAYOUT EVENTS TABLE
-- ============================================================

create type public.payout_status as enum ('paid', 'failed', 'canceled');

create table public.payout_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payout_id text not null,
  status public.payout_status not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

create unique index payout_events_stripe_id on public.payout_events (stripe_payout_id);
create index payout_events_user on public.payout_events (user_id);

alter table public.payout_events enable row level security;
