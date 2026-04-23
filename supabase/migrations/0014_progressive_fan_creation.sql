-- 0014_progressive_fan_creation.sql
-- Progressive fan account creation: webhook_errors table,
-- purchase linking indexes, and purchase-to-user backfill trigger.

-- ============================================================
-- 1. INDEXES for progressive account linking
-- ============================================================

create index if not exists purchases_buyer_email_idx
  on public.purchases(buyer_email);

create index if not exists purchases_buyer_user_idx
  on public.purchases(buyer_user_id)
  where buyer_user_id is not null;

-- ============================================================
-- 2. WEBHOOK ERRORS TABLE
-- ============================================================

create table public.webhook_errors (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  event_id    text,
  payload     jsonb,
  error       text not null,
  created_at  timestamptz not null default now()
);

create index webhook_errors_created_idx on public.webhook_errors(created_at desc);

alter table public.webhook_errors enable row level security;
-- No client access — service_role only.

-- ============================================================
-- 3. TRIGGER: link purchases when a new user is created
-- ============================================================
-- When handle_new_user fires and creates the fan_profiles row,
-- this trigger links any existing purchases with matching email
-- to the new user's buyer_user_id.

create or replace function private.link_purchases_to_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.purchases
  set buyer_user_id = new.id
  where buyer_email = new.email
    and buyer_user_id is null;
  return new;
end;
$$;

create trigger on_user_created_link_purchases
  after insert on auth.users
  for each row
  execute function private.link_purchases_to_new_user();

-- ============================================================
-- 4. RPC: look up user ID by email (service_role only)
-- ============================================================

create or replace function public.get_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users where email = lookup_email limit 1;
$$;

-- Only callable by service_role (no RLS bypass for anon/authenticated)
revoke execute on function public.get_user_id_by_email(text) from anon, authenticated;
