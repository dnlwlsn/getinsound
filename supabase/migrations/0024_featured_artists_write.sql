create policy featured_artists_insert_auth on public.featured_artists
  for insert to authenticated with check (true);

create policy featured_artists_update_auth on public.featured_artists
  for update to authenticated using (true) with check (true);
