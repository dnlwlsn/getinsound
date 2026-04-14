-- Auto-create artists + artist_accounts rows when a new auth.users row is inserted.
-- Metadata (artist_name, slug, self_attest) is passed from the client via
-- supabase.auth.signUp({ options: { data: { ... } } }).

create schema if not exists private;

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

    insert into public.artist_accounts (id, email, self_attest_independent)
    values (
      new.id,
      new.email,
      coalesce((new.raw_user_meta_data->>'self_attest')::boolean, false)
    );
  end if;
  return new;
end;
$$;

-- Lock the function down so it can't be called as an RPC by clients.
revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
