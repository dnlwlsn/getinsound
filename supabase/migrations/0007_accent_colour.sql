-- Add accent_colour to artists table.
-- Nullable hex string; defaults to NULL (frontend falls back to #F56D00).

alter table public.artists
  add column if not exists accent_colour text
    check (accent_colour is null or accent_colour ~ '^#[0-9a-fA-F]{6}$');
