// Edge Function: notify-preorder-change
// Sends email notification to pre-order holders when the release date changes.
// Called from the dashboard when an artist updates a pre-order release date.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('authorization') ?? '';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { release_id: string; old_date: string; new_date: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { release_id, old_date, new_date } = body;
  if (!release_id || !new_date) return json({ error: 'release_id and new_date required' }, 400);

  const { data: release } = await admin
    .from('releases')
    .select('id, title, artist_id, artists!inner(name)')
    .eq('id', release_id)
    .single();

  if (!release || release.artist_id !== user.id) {
    return json({ error: 'Release not found' }, 404);
  }

  const { data: purchases } = await admin
    .from('purchases')
    .select('buyer_email')
    .eq('release_id', release_id)
    .eq('pre_order', true)
    .eq('status', 'paid');

  if (!purchases || purchases.length === 0) {
    return json({ notified: 0 });
  }

  // Update release_date on purchases too
  await admin
    .from('purchases')
    .update({ release_date: new_date })
    .eq('release_id', release_id)
    .eq('pre_order', true)
    .eq('status', 'paid');

  const artistObj = Array.isArray(release.artists) ? release.artists[0] : release.artists;
  const artistName = (artistObj as any)?.name ?? 'the artist';

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const emailBatch = purchases.map((p) => ({
    from: 'Insound <noreply@getinsound.com>',
    to: [p.buyer_email],
    subject: 'Your pre-order date has changed',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          ${escapeHtml(release.title)} will now be available on ${formatDate(new_date)}${old_date ? ` instead of ${formatDate(old_date)}` : ''}.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          Your purchase is still valid. If you&rsquo;d like a refund, contact us.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            View your library &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }));

  let sent = 0;
  for (let i = 0; i < emailBatch.length; i += 100) {
    const chunk = emailBatch.slice(i, i + 100);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    } catch (e) {
      console.error('Notify emails failed:', (e as Error).message);
    }
  }

  return json({ notified: sent });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
