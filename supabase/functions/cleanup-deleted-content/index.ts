// Triggered by pg_cron daily at 3am UTC.
// Removes expired artist files from storage, deletes release/track rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: releases, error } = await admin
    .from('releases')
    .select('id, artist_id, tracks(id, audio_path, preview_path), cover_url')
    .eq('visibility', 'deleted')
    .lte('deletion_retain_until', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!releases || releases.length === 0) {
    return new Response(JSON.stringify({ cleaned: 0 }));
  }

  let cleaned = 0;
  for (const release of releases) {
    try {
      const tracks = release.tracks ?? [];
      const masterPaths = tracks.map((t: any) => t.audio_path).filter(Boolean);
      const previewPaths = tracks.map((t: any) => t.preview_path).filter(Boolean);

      if (masterPaths.length > 0) {
        await admin.storage.from('masters').remove(masterPaths);
      }
      if (previewPaths.length > 0) {
        await admin.storage.from('previews').remove(previewPaths);
      }

      if (release.cover_url) {
        const coverPath = release.cover_url.split('/covers/')[1];
        if (coverPath) {
          await admin.storage.from('covers').remove([coverPath]);
        }
      }

      await admin.from('releases').delete().eq('id', release.id);

      cleaned++;
    } catch (e) {
      console.error(`Cleanup failed for release ${release.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ cleaned }));
});
