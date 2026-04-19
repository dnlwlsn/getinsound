-- 0012_fan_profiles_public.sql
-- Public fan profiles: pinned releases, hidden purchases, artist posts,
-- fan badges, RLS for public viewing, avatar storage.

-- ============================================================
-- 1. FAN PROFILES: fix default + constraints
-- ============================================================

-- Default private until fan opts in (spec overrides 0011's default true)
alter table public.fan_profiles alter column is_public set default false;
update public.fan_profiles set is_public = false;

-- Username uniqueness + format validation
create unique index if not exists fan_profiles_username_unique
  on public.fan_profiles (username) where username is not null;

alter table public.fan_profiles
  add constraint fan_profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- ============================================================
-- 2. FAN PINNED RELEASES
-- ============================================================

create table public.fan_pinned_releases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  position   integer not null check (position >= 1 and position <= 3),
  created_at timestamptz not null default now(),
  unique (user_id, position),
  unique (user_id, release_id)
);

create index fan_pinned_user_idx on public.fan_pinned_releases(user_id);

alter table public.fan_pinned_releases enable row level security;

create policy fan_pinned_select_own on public.fan_pinned_releases
  for select using ((select auth.uid()) = user_id);
create policy fan_pinned_insert_own on public.fan_pinned_releases
  for insert with check ((select auth.uid()) = user_id);
create policy fan_pinned_update_own on public.fan_pinned_releases
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy fan_pinned_delete_own on public.fan_pinned_releases
  for delete using ((select auth.uid()) = user_id);
create policy fan_pinned_read_public on public.fan_pinned_releases
  for select using (
    exists (select 1 from public.fan_profiles fp
            where fp.id = fan_pinned_releases.user_id and fp.is_public = true)
  );

-- ============================================================
-- 3. FAN HIDDEN PURCHASES
-- ============================================================

create table public.fan_hidden_purchases (
  user_id     uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, purchase_id)
);

alter table public.fan_hidden_purchases enable row level security;

create policy fan_hidden_select_own on public.fan_hidden_purchases
  for select using ((select auth.uid()) = user_id);
create policy fan_hidden_insert_own on public.fan_hidden_purchases
  for insert with check ((select auth.uid()) = user_id);
create policy fan_hidden_delete_own on public.fan_hidden_purchases
  for delete using ((select auth.uid()) = user_id);

-- ============================================================
-- 4. FAN BADGES
-- ============================================================

create table public.fan_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_type text not null check (badge_type in ('founding_fan', 'limited_edition', 'early_supporter')),
  release_id uuid references public.releases(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_type, release_id)
);

create index fan_badges_user_idx on public.fan_badges(user_id);

alter table public.fan_badges enable row level security;

-- Badges are public on public profiles
create policy fan_badges_select_own on public.fan_badges
  for select using ((select auth.uid()) = user_id);
create policy fan_badges_read_public on public.fan_badges
  for select using (
    exists (select 1 from public.fan_profiles fp
            where fp.id = fan_badges.user_id and fp.is_public = true)
  );
-- Only service_role inserts badges (via triggers/functions)

-- ============================================================
-- 5. ARTIST POSTS (The Wall)
-- ============================================================

create table public.artist_posts (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists(id) on delete cascade,
  post_type  text not null check (post_type in ('text', 'photo', 'demo', 'voice_note')),
  content    text not null,
  media_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artist_posts_artist_idx on public.artist_posts(artist_id);
create index artist_posts_created_idx on public.artist_posts(created_at desc);

create trigger set_updated_at before update on public.artist_posts
  for each row execute function public.tg_set_updated_at();

alter table public.artist_posts enable row level security;

-- Public read (anyone can see posts from artists they follow/purchased from)
create policy artist_posts_read_all on public.artist_posts
  for select using (true);
-- Artist can CRUD their own posts
create policy artist_posts_insert_own on public.artist_posts
  for insert with check ((select auth.uid()) = artist_id);
create policy artist_posts_update_own on public.artist_posts
  for update using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id);
create policy artist_posts_delete_own on public.artist_posts
  for delete using ((select auth.uid()) = artist_id);

-- ============================================================
-- 6. RLS POLICIES FOR PUBLIC FAN PROFILES
-- ============================================================

-- Anyone can read public fan profiles
create policy fan_profiles_read_public on public.fan_profiles
  for select using (is_public = true);

-- Buyer can read their own purchases (not just artist)
create policy purchases_read_buyer on public.purchases
  for select using ((select auth.uid()) = buyer_user_id);

-- Purchases of public fans are readable (excluding hidden)
create policy purchases_read_public_fan on public.purchases
  for select using (
    exists (
      select 1 from public.fan_profiles fp
      where fp.id = purchases.buyer_user_id and fp.is_public = true
    )
    and not exists (
      select 1 from public.fan_hidden_purchases fhp
      where fhp.user_id = purchases.buyer_user_id
        and fhp.purchase_id = purchases.id
    )
  );

-- ============================================================
-- 7. STORAGE: fan avatars + artist post media
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Avatars: public read, owner writes to own folder
create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Post media: public read, artist writes to own folder
create policy post_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'post-media');
create policy post_media_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- 8. BADGE AWARDING: founding_fan for first 1000 waitlist signups
-- ============================================================

-- Award founding_fan badge to existing waitlist users (first 1000)
insert into public.fan_badges (user_id, badge_type)
select fp.id, 'founding_fan'
from public.fan_profiles fp
where not exists (
  select 1 from public.fan_badges fb
  where fb.user_id = fp.id and fb.badge_type = 'founding_fan'
)
order by fp.created_at asc
limit 1000;
