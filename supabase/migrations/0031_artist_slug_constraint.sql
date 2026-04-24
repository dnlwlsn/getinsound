-- Prevent artist slugs from colliding with application routes
alter table public.artists
  add constraint artists_slug_not_reserved
  check (slug not in (
    'admin', 'ai-policy', 'api', 'auth', 'become-an-artist',
    'dashboard', 'discography', 'discover', 'download', 'explore',
    'for-artists', 'for-fans', 'for-press', 'library', 'login',
    'notifications', 'player', 'press', 'privacy', 'redeem',
    'release', 'sales', 'search', 'settings', 'signup',
    'terms', 'welcome', 'why-us'
  ));
