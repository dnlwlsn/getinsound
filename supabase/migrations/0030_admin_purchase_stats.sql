create or replace function public.admin_purchase_stats(since_ts timestamptz default null)
returns table (
  total_sales   bigint,
  total_revenue bigint,
  artist_received bigint,
  platform_revenue bigint,
  stripe_fees   bigint
)
language sql
stable
security definer
as $$
  select
    count(*)::bigint as total_sales,
    coalesce(sum(amount_pence), 0)::bigint as total_revenue,
    coalesce(sum(artist_pence), 0)::bigint as artist_received,
    coalesce(sum(platform_pence), 0)::bigint as platform_revenue,
    coalesce(sum(stripe_fee_pence), 0)::bigint as stripe_fees
  from public.purchases
  where status = 'paid'
    and (since_ts is null or paid_at >= since_ts);
$$;
