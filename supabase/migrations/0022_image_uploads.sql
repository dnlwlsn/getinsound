-- 0022_image_uploads.sql
-- Add banner_url to artists, create banners bucket, add delete policies for storage cleanup.

-- ============================================================
-- 1. ARTISTS: add banner_url column
-- ============================================================

alter table public.artists add column if not exists banner_url text;

-- ============================================================
-- 2. STORAGE: banners bucket (public read, authenticated write)
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('banners', 'banners', true)
on conflict (id) do nothing;

-- Public read
create policy banners_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'banners');

-- Owner writes to own folder
create policy banners_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Owner can update own files
create policy banners_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Owner can delete own files
create policy banners_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- 3. STORAGE: add delete policy for avatars (was missing)
-- ============================================================

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
