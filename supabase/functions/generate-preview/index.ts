// Edge Function: generate-preview
// Generates a 30-second MP3 preview clip from a master audio file.
//
// NOTE: This is a placeholder. Supabase Edge Functions run on Deno Deploy,
// which does not have ffmpeg installed and FFmpeg WASM support is unreliable.
// For launch, preview playback is enforced client-side (the player stops at
// 30 seconds). This function can be used later when running on infrastructure
// with ffmpeg available (e.g. a self-hosted Supabase instance, a VM-based
// worker, or a Docker-based job runner).
//
// To generate previews in bulk, run this as a batch job on a server with
// ffmpeg installed, calling the Supabase API directly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const SIGNED_URL_TTL_SEC = 60 * 15; // 15 minutes (enough time to download + process)
const PREVIEW_DURATION_SEC = 30;
const PREVIEW_BITRATE = '128k';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate — require service_role key
    const authHeader = req.headers.get('authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const trackId: string | undefined = body.track_id;
    if (!trackId) return json({ error: 'track_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    );

    // Fetch the track
    const { data: track, error: trackErr } = await admin
      .from('tracks')
      .select('id, audio_path, preview_path, release_id')
      .eq('id', trackId)
      .single();

    if (trackErr || !track) return json({ error: 'Track not found' }, 404);
    if (!track.audio_path) return json({ error: 'Track has no audio file' }, 400);
    if (track.preview_path) return json({ ok: true, preview_path: track.preview_path });

    // Fetch the release to get artist_id for the storage path
    const { data: release, error: releaseErr } = await admin
      .from('releases')
      .select('artist_id')
      .eq('id', track.release_id)
      .single();

    if (releaseErr || !release) return json({ error: 'Release not found' }, 404);

    // Generate a signed URL for the master audio
    const { data: signed, error: signErr } = await admin.storage
      .from('masters')
      .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SEC);

    if (signErr || !signed) return json({ error: 'Failed to get master URL' }, 500);

    // --- FFmpeg processing ---
    // This requires ffmpeg to be available on the runtime. On Deno Deploy this
    // will fail. When running on infrastructure with ffmpeg (Docker, VM, etc.),
    // uncomment and use the code below.
    //
    // const masterUrl = signed.signedUrl;
    // const previewPath = `${release.artist_id}/${track.release_id}/${track.id}.mp3`;
    //
    // // Download master to a temp file
    // const tempIn = await Deno.makeTempFile();
    // const tempOut = await Deno.makeTempFile({ suffix: '.mp3' });
    //
    // const downloadResp = await fetch(masterUrl);
    // if (!downloadResp.ok) return json({ error: 'Failed to download master' }, 500);
    // const masterBytes = new Uint8Array(await downloadResp.arrayBuffer());
    // await Deno.writeFile(tempIn, masterBytes);
    //
    // // Run ffmpeg: first 30s, 128kbps MP3, 2s fade-out at end
    // const fadeStart = PREVIEW_DURATION_SEC - 2;
    // const cmd = new Deno.Command('ffmpeg', {
    //   args: [
    //     '-i', tempIn,
    //     '-t', String(PREVIEW_DURATION_SEC),
    //     '-af', `afade=t=out:st=${fadeStart}:d=2`,
    //     '-b:a', PREVIEW_BITRATE,
    //     '-f', 'mp3',
    //     '-y', tempOut,
    //   ],
    //   stdout: 'piped',
    //   stderr: 'piped',
    // });
    //
    // const result = await cmd.output();
    // if (!result.success) {
    //   const stderr = new TextDecoder().decode(result.stderr);
    //   console.error('ffmpeg failed:', stderr);
    //   await Deno.remove(tempIn).catch(() => {});
    //   await Deno.remove(tempOut).catch(() => {});
    //   return json({ error: 'FFmpeg processing failed' }, 500);
    // }
    //
    // // Upload the preview
    // const previewBytes = await Deno.readFile(tempOut);
    // const { error: uploadErr } = await admin.storage
    //   .from('previews')
    //   .upload(previewPath, previewBytes, {
    //     contentType: 'audio/mpeg',
    //     upsert: true,
    //   });
    //
    // // Clean up temp files
    // await Deno.remove(tempIn).catch(() => {});
    // await Deno.remove(tempOut).catch(() => {});
    //
    // if (uploadErr) return json({ error: uploadErr.message }, 500);
    //
    // // Update the track record
    // const { error: updateErr } = await admin
    //   .from('tracks')
    //   .update({ preview_path: previewPath })
    //   .eq('id', track.id);
    //
    // if (updateErr) return json({ error: updateErr.message }, 500);
    //
    // return json({ ok: true, preview_path: previewPath });

    return json({
      error: 'Preview generation is not available on this runtime. ' +
             'FFmpeg is required but not installed on Deno Deploy. ' +
             'Run this function on infrastructure with ffmpeg available.',
    }, 501);
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
