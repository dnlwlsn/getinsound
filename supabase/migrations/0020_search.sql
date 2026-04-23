-- Full-text search: tsvector columns, GIN indexes, RPCs, trigram fallback, search_logs

-- ============================================================
-- 1. TSVECTOR COLUMNS + GIN INDEXES
-- ============================================================

alter table public.artists
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) stored;

create index artists_search_idx on public.artists using gin(search_vector);

alter table public.releases
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'B')
  ) stored;

create index releases_search_idx on public.releases using gin(search_vector);

-- ============================================================
-- 2. TRIGRAM EXTENSION + INDEXES (fuzzy fallback)
-- ============================================================

create extension if not exists pg_trgm;

create index artists_name_trgm_idx on public.artists using gin(name gin_trgm_ops);
create index releases_title_trgm_idx on public.releases using gin(title gin_trgm_ops);

-- ============================================================
-- 3. SEARCH RPC: artists
-- ============================================================

create or replace function public.search_artists(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  name text,
  avatar_url text,
  bio text,
  release_count bigint,
  rank real
)
language sql stable
as $$
  select
    a.id, a.slug, a.name, a.avatar_url, a.bio,
    (select count(*) from public.releases r
     where r.artist_id = a.id and r.published = true) as release_count,
    ts_rank(a.search_vector, websearch_to_tsquery('english', query)) as rank
  from public.artists a
  where a.search_vector @@ websearch_to_tsquery('english', query)
  order by rank desc
  limit max_results;
$$;

-- ============================================================
-- 4. SEARCH RPC: releases (albums/EPs boosted above singles)
-- ============================================================

create or replace function public.search_releases(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  title text,
  type text,
  cover_url text,
  genre text,
  price_pence integer,
  currency text,
  artist_id uuid,
  artist_name text,
  artist_slug text,
  rank real
)
language sql stable
as $$
  select
    r.id, r.slug, r.title, r.type, r.cover_url, r.genre,
    r.price_pence, r.currency,
    a.id as artist_id, a.name as artist_name, a.slug as artist_slug,
    ts_rank(r.search_vector, websearch_to_tsquery('english', query))
      * case r.type when 'album' then 1.3 when 'ep' then 1.15 else 1.0 end
      as rank
  from public.releases r
  join public.artists a on a.id = r.artist_id
  where r.published = true
    and r.search_vector @@ websearch_to_tsquery('english', query)
  order by rank desc
  limit max_results;
$$;

-- ============================================================
-- 5. FUZZY FALLBACK RPCs (trigram similarity)
-- ============================================================

create or replace function public.search_artists_fuzzy(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  name text,
  avatar_url text,
  bio text,
  release_count bigint,
  rank real
)
language sql stable
as $$
  select
    a.id, a.slug, a.name, a.avatar_url, a.bio,
    (select count(*) from public.releases r
     where r.artist_id = a.id and r.published = true) as release_count,
    similarity(a.name, query) as rank
  from public.artists a
  where similarity(a.name, query) > 0.15
  order by rank desc
  limit max_results;
$$;

create or replace function public.search_releases_fuzzy(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  title text,
  type text,
  cover_url text,
  genre text,
  price_pence integer,
  currency text,
  artist_id uuid,
  artist_name text,
  artist_slug text,
  rank real
)
language sql stable
as $$
  select
    r.id, r.slug, r.title, r.type, r.cover_url, r.genre,
    r.price_pence, r.currency,
    a.id as artist_id, a.name as artist_name, a.slug as artist_slug,
    similarity(r.title, query)
      * case r.type when 'album' then 1.3 when 'ep' then 1.15 else 1.0 end
      as rank
  from public.releases r
  join public.artists a on a.id = r.artist_id
  where r.published = true
    and similarity(r.title, query) > 0.15
  order by rank desc
  limit max_results;
$$;

-- ============================================================
-- 6. SEARCH LOGS
-- ============================================================

create table public.search_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  query         text not null,
  results_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index search_logs_created_idx on public.search_logs(created_at desc);

alter table public.search_logs enable row level security;
-- No RLS policies on the table itself — writes go through the security definer RPC below

-- RPC for logging (security definer so anon/authenticated callers can insert)
create or replace function public.log_search(
  p_user_id uuid,
  p_query text,
  p_results_count integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.search_logs (user_id, query, results_count)
  values (p_user_id, p_query, p_results_count);
$$;
