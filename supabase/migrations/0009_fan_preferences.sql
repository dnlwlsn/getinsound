-- Fan profiles and genre preferences for onboarding mood board
-- fan_profiles: lightweight row per fan user (created on first purchase)
-- fan_preferences: genre selections from the onboarding mood board

create table public.fan_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  preferences_skipped  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger set_updated_at before update on public.fan_profiles
  for each row execute function public.tg_set_updated_at();

alter table public.fan_profiles enable row level security;

create policy fan_profiles_select_self on public.fan_profiles
  for select using ((select auth.uid()) = id);
create policy fan_profiles_insert_self on public.fan_profiles
  for insert with check ((select auth.uid()) = id);
create policy fan_profiles_update_self on public.fan_profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Genre preferences
create table public.fan_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  genre      text not null,
  created_at timestamptz not null default now(),
  unique (user_id, genre)
);

create index fan_preferences_user_idx on public.fan_preferences(user_id);

alter table public.fan_preferences enable row level security;

create policy fan_preferences_select_self on public.fan_preferences
  for select using ((select auth.uid()) = user_id);
create policy fan_preferences_insert_self on public.fan_preferences
  for insert with check ((select auth.uid()) = user_id);
create policy fan_preferences_delete_self on public.fan_preferences
  for delete using ((select auth.uid()) = user_id);
