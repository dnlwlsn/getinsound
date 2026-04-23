-- First sale milestone tracking
alter table artists
  add column milestone_first_sale boolean not null default false,
  add column milestone_first_sale_at timestamptz,
  add column milestone_first_sale_shown boolean not null default false,
  add column milestone_first_sale_shown_at timestamptz;
