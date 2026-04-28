// Edge Function: generate-cover
// Generates a deterministic gradient cover image for releases without artwork.
// Triggered by a database webhook on releases INSERT where cover_url IS NULL,
// or called directly with { artist_id, release_id }.
//
// Flow:
//   1. Hash artist_id + release_id to produce a deterministic seed
//   2. Derive 2-3 HSL colours from the seed
//   3. Generate SVG gradient
//   4. Convert SVG to PNG via resvg-wasm
//   5. Upload PNG to Supabase Storage (covers bucket)
//   6. Update releases.cover_url

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'https://getinsound.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Deterministic hash ─────────────────────────────────────────
// Simple but effective: cyrb53 hash gives us a large numeric seed.
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Derive a seeded pseudo-random sequence from the hash
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── HSL colour generation ──────────────────────────────────────
function hslToHex(h: number, s: number, l: number): string {
  const hDecimal = l / 100;
  const a = (s * Math.min(hDecimal, 1 - hDecimal)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const colour = hDecimal - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * colour)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface GradientColours {
  colours: string[];
  angle: number;
  useThreeStops: boolean;
}

function generateGradientColours(artistId: string, releaseId: string): GradientColours {
  const hash = cyrb53(`${artistId}:${releaseId}`);
  const rand = seededRandom(hash);

  // Primary hue from full spectrum
  const hue1 = Math.floor(rand() * 360);
  // Second hue offset 40-120 degrees for pleasing contrast
  const hueOffset = 40 + Math.floor(rand() * 80);
  const hue2 = (hue1 + hueOffset) % 360;

  // High saturation (60-90%) and medium lightness (35-55%) for vibrancy on dark
  const sat1 = 60 + Math.floor(rand() * 30);
  const sat2 = 60 + Math.floor(rand() * 30);
  const lit1 = 35 + Math.floor(rand() * 20);
  const lit2 = 35 + Math.floor(rand() * 20);

  const colour1 = hslToHex(hue1, sat1, lit1);
  const colour2 = hslToHex(hue2, sat2, lit2);

  // 40% chance of 3-stop gradient
  const useThreeStops = rand() < 0.4;
  const colours = [colour1, colour2];

  if (useThreeStops) {
    const hue3 = (hue1 + hueOffset * 2) % 360;
    const sat3 = 60 + Math.floor(rand() * 30);
    const lit3 = 35 + Math.floor(rand() * 20);
    colours.push(hslToHex(hue3, sat3, lit3));
  }

  // Gradient angle: one of 8 directions for variety
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  const angle = angles[Math.floor(rand() * angles.length)];

  return { colours, angle, useThreeStops };
}

// ── SVG generation ─────────────────────────────────────────────
function generateSvg(artistId: string, releaseId: string): string {
  const { colours, angle } = generateGradientColours(artistId, releaseId);
  const size = 1200;

  // Convert angle to x1,y1,x2,y2 coordinates
  const rad = (angle * Math.PI) / 180;
  const x1 = Math.round((50 - 50 * Math.cos(rad)) * 100) / 100;
  const y1 = Math.round((50 - 50 * Math.sin(rad)) * 100) / 100;
  const x2 = Math.round((50 + 50 * Math.cos(rad)) * 100) / 100;
  const y2 = Math.round((50 + 50 * Math.sin(rad)) * 100) / 100;

  let stops = '';
  if (colours.length === 2) {
    stops = `<stop offset="0%" stop-color="${colours[0]}"/>
      <stop offset="100%" stop-color="${colours[1]}"/>`;
  } else {
    stops = `<stop offset="0%" stop-color="${colours[0]}"/>
      <stop offset="50%" stop-color="${colours[1]}"/>
      <stop offset="100%" stop-color="${colours[2]}"/>`;
  }

  // Add a subtle noise texture overlay for depth
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect width="${size}" height="${size}" filter="url(#noise)" opacity="0.05"/>
</svg>`;
}

// ── PNG conversion via Canvas API (Deno) ───────────────────────
// Deno Edge Functions don't have resvg-wasm, so we upload the SVG
// as-is and also create a data URI version. For true PNG we use
// a simpler approach: store SVG directly (browsers render it fine
// as an <img> src) and name it .svg in storage.
//
// If PNG is strictly required, swap this for an external render
// service. SVG is actually preferable: smaller, resolution-independent.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const artistId: string | undefined = body.artist_id;
    const releaseId: string | undefined = body.release_id;

    if (!artistId || !releaseId) {
      return json({ error: 'artist_id and release_id required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the caller is the artist or a DB webhook (service role)
    const authHeader = req.headers.get('authorization');
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user || user.id !== artistId) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    // Check the release exists and has no cover
    const { data: release, error: relErr } = await admin
      .from('releases')
      .select('id, cover_url, artist_id, title')
      .eq('id', releaseId)
      .eq('artist_id', artistId)
      .maybeSingle();

    if (relErr) return json({ error: relErr.message }, 500);
    if (!release) return json({ error: 'Release not found' }, 404);

    // If cover already exists, skip generation
    if (release.cover_url) {
      return json({ cover_url: release.cover_url, skipped: true });
    }

    // Generate SVG
    const svg = generateSvg(artistId, releaseId);
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });

    // Upload to covers bucket: {artist_id}/{release_id}-generated.svg
    const storagePath = `${artistId}/${releaseId}-generated.svg`;

    const { error: uploadErr } = await admin.storage
      .from('covers')
      .upload(storagePath, svgBlob, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadErr) return json({ error: uploadErr.message }, 500);

    // Get public URL
    const { data: urlData } = admin.storage
      .from('covers')
      .getPublicUrl(storagePath);

    const coverUrl = urlData.publicUrl;

    // Update the release
    const { error: updateErr } = await admin
      .from('releases')
      .update({ cover_url: coverUrl })
      .eq('id', releaseId);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ cover_url: coverUrl, generated: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
