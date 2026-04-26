create or replace function increment_play_count(track_id uuid, is_preview boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if is_preview then
    update public.tracks set preview_plays = preview_plays + 1 where id = track_id;
  else
    update public.tracks set full_plays = full_plays + 1 where id = track_id;
  end if;
end;
$$;

create or replace function increment_download_grant_usage(grant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.download_grants set used_count = used_count + 1 where id = grant_id;
end;
$$;
