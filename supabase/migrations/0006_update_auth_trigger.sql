-- Update the auth trigger to populate independence_confirmed and
-- independence_confirmed_at from signup metadata.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'artist_name' and new.raw_user_meta_data ? 'slug' then
    insert into public.artists (id, slug, name)
    values (
      new.id,
      new.raw_user_meta_data->>'slug',
      new.raw_user_meta_data->>'artist_name'
    );

    insert into public.artist_accounts (
      id,
      email,
      self_attest_independent,
      independence_confirmed,
      independence_confirmed_at
    )
    values (
      new.id,
      new.email,
      coalesce((new.raw_user_meta_data->>'self_attest')::boolean, false),
      coalesce((new.raw_user_meta_data->>'independence_confirmed')::boolean, false),
      case
        when (new.raw_user_meta_data->>'independence_confirmed')::boolean = true
        then coalesce(
          (new.raw_user_meta_data->>'independence_confirmed_at')::timestamptz,
          now()
        )
        else null
      end
    );
  end if;
  return new;
end;
$$;
