// Edge Function: unlock-preorders
// Scheduled daily — finds pre-order releases past their release_date,
// marks them as available, issues download grants, and emails purchasers.
// Invoke via cron-job.org, Cloudflare Cron Trigger, or supabase cron extension.
// Protected by BROADCAST_SECRET.
// Deploy with --no-verify-jwt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const BROADCAST_SECRET = Deno.env.get('BROADCAST_SECRET')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';
const GRANT_TTL_DAYS = 7;
const GRANT_MAX_USES = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'https://getinsound.com',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || token !== BROADCAST_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: unlocked, error } = await admin.rpc('unlock_preorders');

  if (error) {
    console.error('unlock_preorders failed:', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  if (!unlocked || unlocked.length === 0) {
    return Response.json({ unlocked: 0 }, { headers: corsHeaders });
  }

  // Group by release for download grant creation
  const releaseIds = [...new Set(unlocked.map((r: any) => r.release_id))];

  // Issue download grants for all pre-order purchases of unlocked releases
  for (const releaseId of releaseIds) {
    const { data: purchases } = await admin
      .from('purchases')
      .select('id')
      .eq('release_id', releaseId)
      .eq('pre_order', true)
      .eq('status', 'paid');

    for (const purchase of purchases ?? []) {
      const grantToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + GRANT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await admin.from('download_grants').upsert({
        purchase_id: purchase.id,
        token: grantToken,
        expires_at: expiresAt,
        max_uses: GRANT_MAX_USES,
      }, { onConflict: 'purchase_id', ignoreDuplicates: true });
    }
  }

  // In-app notifications for fans
  for (const releaseId of releaseIds) {
    const { data: purchases } = await admin
      .from('purchases')
      .select('buyer_user_id, releases!inner(title, artists!inner(name))')
      .eq('release_id', releaseId)
      .eq('pre_order', true)
      .eq('status', 'paid')
      .not('buyer_user_id', 'is', null);

    const rows = (purchases ?? [])
      .filter((p: any) => p.buyer_user_id)
      .map((p: any) => {
        const rel = Array.isArray(p.releases) ? p.releases[0] : p.releases;
        const artist = Array.isArray(rel?.artists) ? rel.artists[0] : rel?.artists;
        return {
          user_id: p.buyer_user_id,
          type: 'preorder_ready',
          title: `${rel?.title ?? 'Your pre-order'} is ready!`,
          body: `${artist?.name ?? 'The artist'}'s release is now available to listen and download.`,
          link: '/library',
        };
      });

    if (rows.length > 0) {
      await admin.from('notifications').insert(rows);
    }
  }

  // Send notification emails
  const emails = unlocked.map((row: any) => ({
    from: 'Insound <noreply@getinsound.com>',
    to: [row.buyer_email],
    subject: 'Your music is ready',
    html: buildUnlockEmail(row.release_title, row.artist_name),
  }));

  // Batch in chunks of 100 (Resend limit)
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
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
      else console.error('Resend batch failed:', await res.text());
    } catch (e) {
      console.error('Resend request failed:', (e as Error).message);
    }
  }

  return Response.json(
    { unlocked: releaseIds.length, emails_sent: sent },
    { headers: corsHeaders },
  );
});

function buildUnlockEmail(releaseTitle: string, artistName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:32px;">
          Your pre-order of ${escapeHtml(releaseTitle)} by ${escapeHtml(artistName)} is now available to listen and download.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/library" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Listen now &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
