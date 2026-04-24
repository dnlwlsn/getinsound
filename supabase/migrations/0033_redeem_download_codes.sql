-- 0033_redeem_download_codes.sql
-- Support download-code redemption:
--   1. Add source column to purchases (stripe / download_code)
--   2. Relax amount_pence constraint to allow 0 for free redemptions
--   3. Allow service-role to update download_codes (mark redeemed)
--   4. RPC for atomic code redemption

-- ============================================================
-- 1. PURCHASES: source column + relaxed amount constraint
-- ============================================================

alter table public.purchases
  add column if not exists source text not null default 'stripe'
    check (source in ('stripe', 'download_code'));

-- Relax amount check: download_code purchases are free
alter table public.purchases
  drop constraint if exists purchases_amount_pence_check;
alter table public.purchases
  add constraint purchases_amount_pence_check
    check (
      (source = 'download_code' and amount_pence = 0)
      or (source = 'stripe' and amount_pence >= 200)
    );

-- stripe fields are not required for download_code purchases
-- (they're already nullable, just have unique constraints which is fine)

-- ============================================================
-- 2. RPC: atomic code redemption
-- ============================================================
-- Returns the redeemed code row on success, empty on failure.
-- Uses WHERE redeemed_by IS NULL for atomicity.

create or replace function public.redeem_download_code(
  p_code text,
  p_user_id uuid,
  p_email text
)
returns table (
  code_id uuid,
  release_id uuid,
  artist_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_id uuid;
  v_release_id uuid;
  v_artist_id uuid;
begin
  -- Atomically claim the code
  update public.download_codes
  set redeemed_by = p_user_id,
      redeemed_at = now()
  where code = upper(p_code)
    and redeemed_by is null
    and (expires_at is null or expires_at > now())
  returning id, download_codes.release_id, download_codes.artist_id
    into v_code_id, v_release_id, v_artist_id;

  if v_code_id is null then
    return;
  end if;

  -- Insert free purchase
  insert into public.purchases (
    release_id, artist_id, buyer_email, buyer_user_id,
    amount_pence, artist_pence, platform_pence, stripe_fee_pence,
    status, source, paid_at
  ) values (
    v_release_id, v_artist_id, p_email, p_user_id,
    0, 0, 0, 0,
    'paid', 'download_code', now()
  );

  return query select v_code_id, v_release_id, v_artist_id;
end;
$$;

revoke execute on function public.redeem_download_code(text, uuid, text) from anon, authenticated;
