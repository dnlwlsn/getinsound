-- Discover page: featured artists, genre on releases, artist recommendations

-- ============================================================
-- 1. Add genre to releases
-- ============================================================

alter table public.releases add column genre text;

-- ============================================================
-- 2. Insound Selects: featured artist per week
-- ============================================================

create table public.featured_artists (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid not null references public.artists(id) on delete cascade,
  week_of         date not null,
  editorial_note  text,
  created_at      timestamptz not null default now(),
  unique (week_of)
);

alter table public.featured_artists enable row level security;

create policy featured_artists_read_all on public.featured_artists
  for select using (true);

-- ============================================================
-- 3. Artist recommendations (artists recommending artists)
-- ============================================================

create table public.artist_recommendations (
  id                uuid primary key default gen_random_uuid(),
  recommender_id    uuid not null references public.artists(id) on delete cascade,
  recommended_id    uuid not null references public.artists(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (recommender_id, recommended_id),
  check (recommender_id != recommended_id)
);

create index artist_recommendations_recommender_idx
  on public.artist_recommendations(recommender_id);

alter table public.artist_recommendations enable row level security;

create policy artist_recommendations_read_all on public.artist_recommendations
  for select using (true);

create policy artist_recommendations_insert_own on public.artist_recommendations
  for insert with check ((select auth.uid()) = recommender_id);

create policy artist_recommendations_delete_own on public.artist_recommendations
  for delete using ((select auth.uid()) = recommender_id);

-- Limit to 3 recommendations per artist
create or replace function public.check_recommendation_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.artist_recommendations where recommender_id = new.recommender_id) >= 3 then
    raise exception 'Maximum 3 recommendations per artist';
  end if;
  return new;
end;
$$;

create trigger enforce_recommendation_limit
  before insert on public.artist_recommendations
  for each row execute function public.check_recommendation_limit();
