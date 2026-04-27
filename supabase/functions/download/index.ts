// Edge Function: download
// Anonymous. Takes a Stripe Checkout session_id, looks up the associated
// purchase + download grant, validates it, and returns signed URLs for the
// release's master track files.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

const SITE_URL = Deno.env.get('SITE_URL') || 'https://getinsound.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body.session_id;
    if (!sessionId) return json({ error: 'session_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: purchase, error: purchaseErr } = await admin
      .from('purchases')
      .select('id, release_id, status')
      .eq('stripe_checkout_id', sessionId)
      .maybeSingle();

    if (purchaseErr) return json({ error: purchaseErr.message }, 500);
    if (!purchase) return json({ error: 'pending' }, 202); // webhook hasn't fired yet
    if (purchase.status !== 'paid') return json({ error: 'Purchase not completed' }, 400);

    const { data: grant, error: grantErr } = await admin
      .from('download_grants')
      .select('id, token, expires_at, used_count, max_uses')
      .eq('purchase_id', purchase.id)
      .maybeSingle();

    if (grantErr) return json({ error: grantErr.message }, 500);
    if (!grant) return json({ error: 'pending' }, 202);

    if (new Date(grant.expires_at).getTime() < Date.now()) {
      return json({ error: 'Download link has expired.' }, 410);
    }

    // Atomic increment — only succeeds if under the limit
    const { data: updated, error: incErr } = await admin
      .from('download_grants')
      .update({ used_count: grant.used_count + 1 })
      .eq('id', grant.id)
      .lt('used_count', grant.max_uses)
      .select('id')
      .maybeSingle();

    if (incErr) return json({ error: incErr.message }, 500);
    if (!updated) {
      return json({ error: 'Download limit reached.' }, 410);
    }

    const { data: release, error: releaseErr } = await admin
      .from('releases')
      .select(`
        id, title, cover_url, preorder_enabled, release_date,
        artists!inner ( name ),
        tracks ( id, title, position, audio_path )
      `)
      .eq('id', purchase.release_id)
      .maybeSingle();

    if (releaseErr) return json({ error: releaseErr.message }, 500);
    if (!release) return json({ error: 'Release not found' }, 404);

    // Block downloads for pre-orders where the release date is still in the future
    if (release.preorder_enabled && release.release_date) {
      const releaseDate = new Date(release.release_date);
      if (releaseDate.getTime() > Date.now()) {
        const formatted = releaseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        return json({
          error: `This release is available for pre-order. Downloads will be available on ${formatted}.`,
          release_date: release.release_date,
        }, 403);
      }
    }

    const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists;
    const tracks = [...(release.tracks ?? [])].sort((a, b) => a.position - b.position);

    const signed = await Promise.all(
      tracks.map(async (t) => {
        if (!t.audio_path) return { ...t, url: null };
        const { data, error } = await admin.storage
          .from('masters')
          .createSignedUrl(t.audio_path, SIGNED_URL_TTL_SEC, { download: true });
        if (error) {
          console.error('Signed URL failed:', error.message, t.audio_path);
          return { ...t, url: null };
        }
        return { id: t.id, title: t.title, position: t.position, url: data.signedUrl };
      }),
    );

    return json({
      release: {
        id: release.id,
        title: release.title,
        cover_url: release.cover_url,
        artist_name: artist?.name ?? '',
      },
      tracks: signed,
      expires_at: grant.expires_at,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
