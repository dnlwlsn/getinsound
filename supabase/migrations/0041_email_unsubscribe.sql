alter table public.fan_profiles add column if not exists email_unsubscribed boolean not null default false;
