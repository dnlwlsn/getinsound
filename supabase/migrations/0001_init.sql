-- Insound MVP initial schema
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run
-- Or via CLI once installed: supabase db push

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Public artist profile. Safe to read by anyone.
create table public.artists (
  id         uuid primary key references auth.users(id) on delete cascade,
  slug       text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name       text not null,
  bio        text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private artist data. Never read by anon.
create table public.artist_accounts (
  id                       uuid primary key references public.artists(id) on delete cascade,
  email                    text not null,
  country                  text,
  self_attest_independent  boolean not null default false,
  stripe_account_id        text,
  stripe_onboarded         boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.releases (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$'),
  title       text not null,
  type        text not null check (type in ('album','ep','single')),
  cover_url   text,
  description text,
  price_pence integer not null check (price_pence >= 200),
  currency    text not null default 'GBP' check (currency = 'GBP'),
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (artist_id, slug)
);

create index releases_artist_idx on public.releases(artist_id);
create index releases_published_idx on public.releases(published) where published;

create table public.tracks (
  id           uuid primary key default gen_random_uuid(),
  release_id   uuid not null references public.releases(id) on delete cascade,
  position     integer not null check (position >= 1),
  title        text not null,
  duration_sec integer check (duration_sec is null or duration_sec > 0),
  audio_path   text not null,   -- key in the private "masters" bucket
  preview_path text,             -- key in the public "previews" bucket
  created_at   timestamptz not null default now(),
  unique (release_id, position)
);

create index tracks_release_idx on public.tracks(release_id);

create table public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  release_id         uuid not null references public.releases(id),
  artist_id          uuid not null references public.artists(id),
  buyer_email        text not null,
  buyer_user_id      uuid references auth.users(id),
  amount_pence       integer not null check (amount_pence >= 200),
  artist_pence       integer not null,
  platform_pence     integer not null,
  stripe_fee_pence   integer not null default 0,
  stripe_pi_id       text unique,
  stripe_checkout_id text unique,
  status             text not null default 'pending'
    check (status in ('pending','paid','failed','refunded')),
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);

create index purchases_artist_idx on public.purchases(artist_id);
create index purchases_release_idx on public.purchases(release_id);

create table public.download_grants (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  token       text unique not null,
  expires_at  timestamptz not null,
  used_count  integer not null default 0,
  max_uses    integer not null default 5,
  created_at  timestamptz not null default now()
);

create index download_grants_token_idx on public.download_grants(token);

-- Abuse reports: MVP manual review of non-independent artists.
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artists(id) on delete cascade,
  reporter_email text,
  reason       text not null,
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 2. UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_updated_at before update on public.artists
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.artist_accounts
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.releases
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table public.artists          enable row level security;
alter table public.artist_accounts  enable row level security;
alter table public.releases         enable row level security;
alter table public.tracks           enable row level security;
alter table public.purchases        enable row level security;
alter table public.download_grants  enable row level security;
alter table public.reports          enable row level security;

-- artists: public read, owner write
create policy artists_read_all on public.artists
  for select using (true);
create policy artists_insert_self on public.artists
  for insert with check ((select auth.uid()) = id);
create policy artists_update_self on public.artists
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- artist_accounts: owner only
create policy accounts_select_self on public.artist_accounts
  for select using ((select auth.uid()) = id);
create policy accounts_insert_self on public.artist_accounts
  for insert with check ((select auth.uid()) = id);
create policy accounts_update_self on public.artist_accounts
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- releases: public read when published, owner full CRUD
create policy releases_read_published on public.releases
  for select using (published or (select auth.uid()) = artist_id);
create policy releases_insert_own on public.releases
  for insert with check ((select auth.uid()) = artist_id);
create policy releases_update_own on public.releases
  for update using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id);
create policy releases_delete_own on public.releases
  for delete using ((select auth.uid()) = artist_id);

-- tracks: read if parent release is readable; write if you own the release
create policy tracks_read on public.tracks
  for select using (
    exists (
      select 1 from public.releases r
      where r.id = tracks.release_id
        and (r.published or r.artist_id = (select auth.uid()))
    )
  );
create policy tracks_insert_own on public.tracks
  for insert with check (
    exists (select 1 from public.releases r
            where r.id = release_id and r.artist_id = (select auth.uid()))
  );
create policy tracks_update_own on public.tracks
  for update using (
    exists (select 1 from public.releases r
            where r.id = release_id and r.artist_id = (select auth.uid()))
  );
create policy tracks_delete_own on public.tracks
  for delete using (
    exists (select 1 from public.releases r
            where r.id = release_id and r.artist_id = (select auth.uid()))
  );

-- purchases: artist sees own sales. Buyers don't read via RLS — they use download tokens.
create policy purchases_read_artist on public.purchases
  for select using ((select auth.uid()) = artist_id);
-- No insert/update/delete policies → only service_role (webhook) can write.

-- download_grants: no client access. Service role only (via Edge Function).

-- reports: anyone can file a report; only service_role reads.
create policy reports_insert_any on public.reports
  for insert with check (true);

-- ============================================================
-- 4. STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('covers',   'covers',   true),
  ('previews', 'previews', true),
  ('masters',  'masters',  false)
on conflict (id) do nothing;

-- covers: public read, artist writes to their own folder {artist_id}/...
create policy covers_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'covers');
create policy covers_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy covers_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy covers_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- previews: public read, artist writes to their own folder
create policy previews_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'previews');
create policy previews_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy previews_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy previews_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- masters: NO public read. Artist can write to their folder. Reads only via
-- service_role signed URLs issued by the `download` Edge Function.
create policy masters_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'masters'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy masters_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'masters'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy masters_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'masters'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
-- Owner SELECT so the artist can read their own masters from the dashboard:
create policy masters_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'masters'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
