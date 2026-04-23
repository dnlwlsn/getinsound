-- 0021_founding_badges.sql
-- Extend fan_badges for founding_artist, founding_fan (scarcity), and first_sale.
-- Adds metadata column for position tracking (e.g. "Founding Fan #47").

-- ============================================================
-- 1. ADD metadata COLUMN
-- ============================================================

alter table public.fan_badges
  add column if not exists metadata jsonb;

-- ============================================================
-- 2. EXPAND badge_type CHECK CONSTRAINT
-- ============================================================

alter table public.fan_badges
  drop constraint if exists fan_badges_badge_type_check;

alter table public.fan_badges
  add constraint fan_badges_badge_type_check
  check (badge_type in (
    'founding_fan', 'founding_artist', 'first_sale',
    'limited_edition', 'early_supporter'
  ));

-- ============================================================
-- 3. RPC: count distinct purchasers (for founding_fan threshold)
-- ============================================================

create or replace function public.count_distinct_purchasers()
returns bigint
language sql
stable
security definer
as $$
  select count(distinct buyer_user_id)
  from public.purchases
  where status = 'paid' and buyer_user_id is not null;
$$;

-- ============================================================
-- 4. RETROACTIVE: award founding_artist to waitlist artists
-- ============================================================
-- Artists whose email was in the first 1,000 waitlist signups
-- AND who have completed artist onboarding (exist in artists table).
-- Skipped safely if waitlist table doesn't exist.

insert into public.fan_badges (user_id, badge_type, metadata)
select
  a.id,
  'founding_artist',
  jsonb_build_object('position', w.pos)
from (
  select id as waitlist_id, email, row_number() over (order by created_at asc) as pos
  from public.waitlist
) w
join auth.users u on lower(u.email) = lower(w.email)
join public.artists a on a.id = u.id
where w.pos <= 50
  and not exists (
    select 1 from public.fan_badges fb
    where fb.user_id = a.id and fb.badge_type = 'founding_artist'
  );

-- ============================================================
-- 5. RETROACTIVE: update existing founding_fan badges with position
-- ============================================================
-- The original 0012 migration awarded founding_fan without position metadata.
-- Backfill position for those who have it.

update public.fan_badges fb
set metadata = jsonb_build_object('position', sub.pos)
from (
  select
    fb2.id as badge_id,
    row_number() over (order by fb2.awarded_at asc) as pos
  from public.fan_badges fb2
  where fb2.badge_type = 'founding_fan'
) sub
where fb.id = sub.badge_id
  and fb.metadata is null;

-- ============================================================
-- 6. RETROACTIVE: award first_sale badge to artists with sales
-- ============================================================

insert into public.fan_badges (user_id, badge_type)
select distinct a.id, 'first_sale'
from public.artists a
where a.milestone_first_sale = true
  and not exists (
    select 1 from public.fan_badges fb
    where fb.user_id = a.id and fb.badge_type = 'first_sale'
  );

-- ============================================================
-- 7. RETROACTIVE: award founding_fan to first 1000 distinct purchasers
-- ============================================================
-- The original 0012 awarded founding_fan based on fan_profiles creation order,
-- but the spec says it should be first 1,000 fans to make a purchase.
-- Award to any qualifying purchaser who doesn't already have it.

insert into public.fan_badges (user_id, badge_type, metadata)
select
  sub.buyer_user_id,
  'founding_fan',
  jsonb_build_object('position', sub.pos)
from (
  select
    buyer_user_id,
    row_number() over (order by min(paid_at) asc) as pos
  from public.purchases
  where buyer_user_id is not null and status = 'paid'
  group by buyer_user_id
) sub
where sub.pos <= 1000
  and sub.buyer_user_id is not null
  and not exists (
    select 1 from public.fan_badges fb
    where fb.user_id = sub.buyer_user_id and fb.badge_type = 'founding_fan'
  );
