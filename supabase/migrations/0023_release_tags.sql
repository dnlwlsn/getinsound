-- Release tags ("sounds") — up to 3 per release, predefined or custom

create table public.release_tags (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references public.releases(id) on delete cascade,
  tag         text not null check (char_length(tag) between 1 and 30),
  is_custom   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (release_id, tag)
);

create index release_tags_tag_idx on public.release_tags(tag);
create index release_tags_release_idx on public.release_tags(release_id);

alter table public.release_tags enable row level security;

create policy "Anyone can read release tags"
  on public.release_tags for select
  using (true);

create policy "Artists can manage their release tags"
  on public.release_tags for all
  using (
    exists (
      select 1 from public.releases r
      join public.artists a on a.id = r.artist_id
      where r.id = release_tags.release_id
        and a.id = auth.uid()
    )
  );

-- Enforce max 3 tags per release
create or replace function public.enforce_max_release_tags()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.release_tags where release_id = NEW.release_id) >= 3 then
    raise exception 'A release can have at most 3 tags';
  end if;
  return NEW;
end;
$$;

create trigger trg_max_release_tags
  before insert on public.release_tags
  for each row execute function public.enforce_max_release_tags();

-- Update search vector to include tags
-- Drop and recreate the generated column to include tags via a subquery
alter table public.releases drop column search_vector;

alter table public.releases
  add column search_vector tsvector;

-- Trigger-based approach since generated columns can't reference other tables
create or replace function public.releases_update_search_vector()
returns trigger
language plpgsql
as $$
begin
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.genre, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (select string_agg(tag, ' ') from public.release_tags where release_id = NEW.id),
      ''
    )), 'B');
  return NEW;
end;
$$;

create trigger trg_releases_search_vector
  before insert or update on public.releases
  for each row execute function public.releases_update_search_vector();

-- Also update the release search vector when tags change
create or replace function public.release_tags_update_search_vector()
returns trigger
language plpgsql
as $$
declare
  rid uuid;
begin
  rid := coalesce(NEW.release_id, OLD.release_id);
  update public.releases set updated_at = now() where id = rid;
  return null;
end;
$$;

create trigger trg_release_tags_search_sync
  after insert or update or delete on public.release_tags
  for each row execute function public.release_tags_update_search_vector();

-- Backfill search vectors for existing releases
update public.releases set updated_at = now();

-- GIN index on tag for filtering
create index release_tags_tag_gin_idx on public.release_tags using gin(tag gin_trgm_ops);
