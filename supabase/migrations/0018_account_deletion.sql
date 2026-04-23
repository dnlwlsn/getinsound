-- 0018_account_deletion.sql
-- GDPR account deletion: request table, release schema changes, pg_cron jobs.

-- ============================================================
-- 1. ACCOUNT DELETION REQUESTS TABLE
-- ============================================================

create table public.account_deletion_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('fan', 'artist')),
  requested_at timestamptz not null default now(),
  execute_at timestamptz not null default (now() + interval '24 hours'),
  last_chance_sent boolean not null default false,
  cancelled boolean not null default false,
  executed boolean not null default false,
  executed_at timestamptz,
  stripe_pending_disconnect boolean not null default false,
  stripe_account_id text
);

-- Only one active (non-cancelled, non-executed) request per user
create unique index account_deletion_requests_active_unique
  on public.account_deletion_requests (user_id)
  where cancelled = false and executed = false;

alter table public.account_deletion_requests enable row level security;

-- Users can read their own requests
create policy "Users can read own deletion requests"
  on public.account_deletion_requests
  for select using (auth.uid() = user_id);

-- Users can create their own requests
create policy "Users can create own deletion requests"
  on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);

-- Users can cancel their own requests (update cancelled only)
create policy "Users can cancel own deletion requests"
  on public.account_deletion_requests
  for update using (auth.uid() = user_id);

-- ============================================================
-- 2. RELEASES: add 'deleted' visibility + retention column
-- ============================================================

-- Drop existing check constraint and add new one with 'deleted'
alter table public.releases
  drop constraint if exists releases_visibility_check;

alter table public.releases
  add constraint releases_visibility_check
  check (visibility in ('public', 'unlisted', 'private', 'deleted'));

alter table public.releases
  add column if not exists deletion_retain_until timestamptz;

-- ============================================================
-- 3. PG_CRON JOBS
-- ============================================================

-- Enable pg_cron and pg_net if not already
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Job 1: Send last-chance emails (every minute)
select cron.schedule(
  'account-deletion-last-chance',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-last-chance-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where cancelled = false
      and executed = false
      and last_chance_sent = false
      and execute_at - now() <= interval '1 hour'
      and execute_at > now()
  );
  $$
);

-- Job 2: Process pending deletions (every minute)
select cron.schedule(
  'account-deletion-process',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-account-deletion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where cancelled = false
      and executed = false
      and execute_at <= now()
  );
  $$
);

-- Job 3: Cleanup deleted artist content (daily 3am UTC)
select cron.schedule(
  'account-deletion-content-cleanup',
  '0 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-deleted-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.releases
    where visibility = 'deleted'
      and deletion_retain_until <= now()
  );
  $$
);

-- Job 4: Retry Stripe disconnections (daily 4am UTC)
select cron.schedule(
  'account-deletion-stripe-retry',
  '0 4 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/retry-stripe-disconnect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where stripe_pending_disconnect = true
      and executed = true
  );
  $$
);
