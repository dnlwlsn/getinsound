create table public.download_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  release_id uuid not null references public.releases(id),
  format     text not null check (format in ('wav', 'flac', 'mp3')),
  track_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index download_events_user_idx on public.download_events(user_id);
create index download_events_release_idx on public.download_events(release_id);
create index download_events_created_idx on public.download_events(created_at);

alter table public.download_events enable row level security;

create policy "Users can insert own download events"
  on public.download_events for insert
  with check (auth.uid() = user_id);

create policy "Users can read own download events"
  on public.download_events for select
  using (auth.uid() = user_id);
