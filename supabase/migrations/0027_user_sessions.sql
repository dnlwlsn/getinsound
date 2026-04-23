-- 0027_user_sessions.sql
-- User session tracking for device management and fresh auth.

create table public.user_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device text not null default 'Unknown device',
  ip_hash text not null,
  ip_display text not null,
  city text,
  country text,
  last_active_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_sessions_user_id on public.user_sessions (user_id);
create index user_sessions_active on public.user_sessions (last_active_at);

alter table public.user_sessions enable row level security;

-- Users can read their own sessions
create policy "Users can read own sessions"
  on public.user_sessions
  for select using (auth.uid() = user_id);

-- Users can delete their own sessions (sign out)
create policy "Users can delete own sessions"
  on public.user_sessions
  for delete using (auth.uid() = user_id);

-- Service role inserts and updates (via RPC)
-- No insert/update policy needed — service_role bypasses RLS

-- ============================================================
-- RPC: Update last_active_at (throttled by caller)
-- ============================================================

create or replace function public.touch_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_sessions
  set last_active_at = now()
  where id = p_session_id;
$$;

-- ============================================================
-- RPC: Update last_verified_at (called on reverify callback)
-- ============================================================

create or replace function public.verify_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_sessions
  set last_verified_at = now()
  where id = p_session_id;
$$;

-- ============================================================
-- Cleanup: delete sessions inactive for 30+ days (daily 2am)
-- ============================================================

select cron.schedule(
  'session-cleanup',
  '0 2 * * *',
  $$
  delete from public.user_sessions
  where last_active_at < now() - interval '30 days';
  $$
);
