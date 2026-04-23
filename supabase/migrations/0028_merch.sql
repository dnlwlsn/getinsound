-- 0028_merch.sql
-- Merch listings, orders, platform costs, storage bucket, and artist return address.

-- ============================================================
-- 1. MERCH TABLE
-- ============================================================

create table public.merch (
  id                uuid primary key default gen_random_uuid(),
  artist_id         uuid not null references public.artists(id) on delete cascade,
  name              text not null,
  description       text not null,
  price             integer not null check (price >= 200),
  currency          text not null default 'GBP',
  postage           integer not null check (postage >= 0),
  stock             integer not null check (stock >= 0),
  variants          jsonb,
  dispatch_estimate text not null default 'Ships within 5 days',
  photos            jsonb not null default '[]'::jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index merch_artist_idx on public.merch(artist_id);
create index merch_active_idx on public.merch(is_active) where is_active;

create trigger set_updated_at before update on public.merch
  for each row execute function public.tg_set_updated_at();

alter table public.merch enable row level security;

create policy "Anyone can read active merch"
  on public.merch for select
  using (is_active = true);

create policy "Artists can read own merch"
  on public.merch for select
  using ((select auth.uid()) = artist_id);

create policy "Artists can insert own merch"
  on public.merch for insert
  with check ((select auth.uid()) = artist_id);

create policy "Artists can update own merch"
  on public.merch for update
  using ((select auth.uid()) = artist_id);

create policy "Artists can delete own merch"
  on public.merch for delete
  using ((select auth.uid()) = artist_id);

-- ============================================================
-- 2. ORDERS TABLE
-- ============================================================

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  fan_id                  uuid not null references auth.users(id) on delete cascade,
  artist_id               uuid not null references public.artists(id) on delete cascade,
  merch_id                uuid not null references public.merch(id),
  variant_selected        text,
  amount_paid             integer not null,
  amount_paid_currency    text not null,
  artist_received         integer not null,
  artist_received_currency text not null,
  platform_pence          integer not null,
  stripe_fee_pence        integer not null default 0,
  postage_paid            integer not null,
  shipping_address        jsonb not null,
  tracking_number         text,
  carrier                 text,
  status                  text not null default 'pending'
    check (status in ('pending','dispatched','delivered','return_requested','returned','refunded','dispute')),
  stripe_payment_intent_id text unique,
  stripe_checkout_id       text unique,
  created_at              timestamptz not null default now(),
  dispatched_at           timestamptz,
  delivered_at            timestamptz,
  return_requested_at     timestamptz,
  returned_at             timestamptz
);

create index orders_artist_idx on public.orders(artist_id);
create index orders_fan_idx on public.orders(fan_id);
create index orders_merch_idx on public.orders(merch_id);
create index orders_status_idx on public.orders(status);

alter table public.orders enable row level security;

create policy "Artists can read own orders"
  on public.orders for select
  using ((select auth.uid()) = artist_id);

create policy "Fans can read own orders"
  on public.orders for select
  using ((select auth.uid()) = fan_id);

-- ============================================================
-- 3. PLATFORM COSTS TABLE
-- ============================================================

create table public.platform_costs (
  id                  uuid primary key default gen_random_uuid(),
  cost_type           text not null
    check (cost_type in ('merch_lost_in_transit','merch_return_stripe_fee','other')),
  amount              integer not null,
  currency            text not null,
  related_order_id    uuid references public.orders(id),
  related_purchase_id uuid references public.purchases(id),
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.platform_costs enable row level security;

-- ============================================================
-- 4. STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values ('merch-images', 'merch-images', true)
on conflict (id) do nothing;

create policy "Anyone can read merch images"
  on storage.objects for select
  using (bucket_id = 'merch-images');

create policy "Artists can upload own merch images"
  on storage.objects for insert
  with check (
    bucket_id = 'merch-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Artists can update own merch images"
  on storage.objects for update
  using (
    bucket_id = 'merch-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Artists can delete own merch images"
  on storage.objects for delete
  using (
    bucket_id = 'merch-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- 5. ARTIST RETURN ADDRESS
-- ============================================================

alter table public.artists add column if not exists return_address jsonb;

-- ============================================================
-- 6. NOTIFICATION TYPES
-- ============================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'new_release', 'preorder_ready', 'order_dispatched', 'artist_post',
    'sale', 'first_sale', 'preorder', 'merch_order', 'code_redeemed',
    'zero_fees_unlocked', 'merch_dispatched', 'merch_delivered',
    'merch_return', 'merch_dispute'
  ));

alter table public.notification_preferences drop constraint if exists notification_preferences_type_check;
alter table public.notification_preferences add constraint notification_preferences_type_check
  check (type in (
    'new_release', 'preorder_ready', 'order_dispatched', 'artist_post',
    'sale', 'first_sale', 'preorder', 'merch_order', 'code_redeemed',
    'zero_fees_unlocked', 'merch_dispatched', 'merch_delivered',
    'merch_return', 'merch_dispute'
  ));

-- ============================================================
-- 7. ENABLE REALTIME ON ORDERS
-- ============================================================

alter publication supabase_realtime add table public.orders;

-- ============================================================
-- 8. ATOMIC STOCK DECREMENT RPC
-- ============================================================

create or replace function public.decrement_merch_stock(merch_id uuid)
returns boolean language plpgsql security definer as $$
declare
  rows_affected integer;
begin
  update public.merch
  set stock = stock - 1
  where id = merch_id and stock > 0;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
