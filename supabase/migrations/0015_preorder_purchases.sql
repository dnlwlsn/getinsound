-- 0015_preorder_purchases.sql
-- Pre-order support: purchase-level pre-order tracking,
-- release cancellation, and unlock infrastructure.

-- ============================================================
-- 1. PURCHASES: pre-order fields
-- ============================================================

alter table public.purchases
  add column if not exists pre_order boolean not null default false,
  add column if not exists release_date date;

create index if not exists purchases_preorder_idx
  on public.purchases(release_id)
  where pre_order = true;

-- ============================================================
-- 2. RELEASES: cancelled flag
-- ============================================================

alter table public.releases
  add column if not exists cancelled boolean not null default false;

-- ============================================================
-- 3. RPC: unlock pre-orders (called by scheduled function)
-- ============================================================
-- Finds releases past their release_date that are still
-- marked as pre-orders, flips preorder_enabled to false,
-- and returns affected release + purchaser data for email.

create or replace function public.unlock_preorders()
returns table (
  release_id uuid,
  release_title text,
  artist_name text,
  buyer_email text
)
language sql
security definer
set search_path = ''
as $$
  -- Mark releases as no longer pre-order
  with unlocked as (
    update public.releases
    set preorder_enabled = false
    where preorder_enabled = true
      and cancelled = false
      and published = true
      and release_date is not null
      and release_date <= current_date
    returning id, title, artist_id
  )
  -- Return purchaser info for email notifications
  select
    u.id as release_id,
    u.title as release_title,
    a.name as artist_name,
    p.buyer_email
  from unlocked u
  join public.artists a on a.id = u.artist_id
  join public.purchases p on p.release_id = u.id
    and p.pre_order = true
    and p.status = 'paid';
$$;

revoke execute on function public.unlock_preorders() from anon, authenticated;

-- ============================================================
-- 4. RPC: cancel pre-order release (returns purchase data for refunds)
-- ============================================================

create or replace function public.cancel_preorder_release(target_release_id uuid)
returns table (
  purchase_id uuid,
  stripe_pi_id text,
  buyer_email text,
  amount_pence integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Verify caller owns this release
  if not exists (
    select 1 from public.releases
    where id = target_release_id
      and artist_id = (select auth.uid())
      and preorder_enabled = true
      and cancelled = false
  ) then
    raise exception 'Release not found or not a cancellable pre-order';
  end if;

  -- Mark release as cancelled
  update public.releases
  set cancelled = true, published = false
  where id = target_release_id;

  -- Return purchases to refund
  return query
    select p.id as purchase_id, p.stripe_pi_id, p.buyer_email, p.amount_pence
    from public.purchases p
    where p.release_id = target_release_id
      and p.pre_order = true
      and p.status = 'paid';
end;
$$;
