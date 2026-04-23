-- Broadcast templates (reusable email templates)
create table broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Broadcast history (sent broadcasts)
create table broadcast_history (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_markdown text not null,
  body_html text not null,
  audience_filter jsonb not null default '{}',
  recipient_count int not null default 0,
  sent_by uuid not null references auth.users(id),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- No RLS — these are admin-only tables accessed via service role key
alter table broadcast_templates enable row level security;
alter table broadcast_history enable row level security;
