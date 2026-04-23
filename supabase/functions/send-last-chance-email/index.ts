// Triggered by pg_cron every minute.
// Finds deletion requests within 1 hour of execution, sends warning email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, execute_at')
    .eq('cancelled', false)
    .eq('executed', false)
    .eq('last_chance_sent', false)
    .lte('execute_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
    .gt('execute_at', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let sent = 0;
  for (const request of requests) {
    const { data: { user } } = await admin.auth.admin.getUserById(request.user_id);
    if (!user?.email) continue;

    const executeDate = new Date(request.execute_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const cancelUrl = `${SITE_URL}/settings/account?cancel-deletion=true`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Insound <noreply@getinsound.com>',
          to: [user.email],
          subject: 'Your account will be deleted in 1 hour',
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your Insound account will be permanently deleted in 1 hour.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          Scheduled deletion: <strong style="color:#FAFAFA">${escapeHtml(executeDate)}</strong>. If you&rsquo;ve changed your mind, click below to cancel.
        </td></tr>
        <tr><td>
          <a href="${cancelUrl}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Cancel deletion &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        }),
      });

      await admin
        .from('account_deletion_requests')
        .update({ last_chance_sent: true })
        .eq('id', request.id);

      sent++;
    } catch (e) {
      console.error(`Last chance email failed for ${request.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ processed: sent }));
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
