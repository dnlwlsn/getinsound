create table if not exists basket_sessions (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null,
  fan_currency text not null default 'GBP',
  ref_code text,
  created_at timestamptz not null default now()
);

alter table basket_sessions enable row level security;
