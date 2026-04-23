-- 0020_notifications.sql
-- In-app notification system: notifications, preferences, Realtime.

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in (
    'new_release', 'preorder_ready', 'order_dispatched', 'artist_post',
    'sale', 'first_sale', 'preorder', 'merch_order', 'code_redeemed', 'zero_fees_unlocked'
  )),
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, read, created_at desc)
  where read = false;

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ============================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- ============================================================

create table public.notification_preferences (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type    text not null check (type in (
    'new_release', 'preorder_ready', 'order_dispatched', 'artist_post',
    'sale', 'first_sale', 'preorder', 'merch_order', 'code_redeemed', 'zero_fees_unlocked'
  )),
  in_app  boolean not null default true,
  email   boolean not null default true,
  unique (user_id, type)
);

alter table public.notification_preferences enable row level security;

create policy "Users can read own preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can upsert own preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

-- ============================================================
-- 3. ENABLE REALTIME
-- ============================================================

alter publication supabase_realtime add table public.notifications;
