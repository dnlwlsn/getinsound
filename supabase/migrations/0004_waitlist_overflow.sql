-- Waitlist overflow table: captures signups after the founding 1,000 fill.
-- Anon can insert; reads are restricted (service_role only).

create table if not exists public.waitlist_overflow (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_overflow enable row level security;

drop policy if exists "anon can insert overflow" on public.waitlist_overflow;
create policy "anon can insert overflow"
  on public.waitlist_overflow
  for insert
  to anon
  with check (true);
