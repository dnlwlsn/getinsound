-- Database webhook trigger: auto-generate cover art for releases without artwork.
-- This creates a pg_net HTTP call to the generate-cover Edge Function
-- whenever a release is inserted with a NULL cover_url.
--
-- Requires the pg_net extension (enabled by default on Supabase).
-- The actual webhook is configured in Supabase Dashboard > Database > Webhooks,
-- but this trigger provides the automatic in-database approach.

create extension if not exists pg_net with schema extensions;

create or replace function private.trigger_generate_cover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _service_key text;
begin
  -- Only fire when cover_url is null on insert
  if new.cover_url is not null then
    return new;
  end if;

  _url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/generate-cover';
  _service_key := current_setting('app.settings.service_role_key', true);

  -- If settings aren't configured, skip silently (webhook approach is the fallback)
  if _url is null or _service_key is null then
    return new;
  end if;

  perform extensions.http_post(
    _url,
    jsonb_build_object(
      'artist_id', new.artist_id,
      'release_id', new.id
    )::text,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || _service_key)
    ]
  );

  return new;
end;
$$;

-- Create trigger on releases table
drop trigger if exists generate_cover_on_insert on public.releases;
create trigger generate_cover_on_insert
  after insert on public.releases
  for each row
  execute function private.trigger_generate_cover();
