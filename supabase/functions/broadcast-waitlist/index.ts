// Edge Function: broadcast-waitlist
// Manually-triggered broadcast. Reads every row from the `waitlist` table
// (plus `waitlist_overflow` if you pass include_overflow=true) and sends
// one Resend email per recipient via Resend's batch endpoint.
//
// Protected by a shared secret (BROADCAST_SECRET) in the Authorization header
// so only you can trigger it. Use service_role key to read the list so RLS
// stays locked down for everyone else.
//
// Required env vars (set with `supabase secrets set`):
//   RESEND_API_KEY       — sk_... from resend.com
//   BROADCAST_SECRET     — any long random string
//   BROADCAST_FROM       — "Dan at Insound <dan@getinsound.com>"
//
// Auto-injected by Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const BROADCAST_SECRET = Deno.env.get('BROADCAST_SECRET')!;
const BROADCAST_FROM = Deno.env.get('BROADCAST_FROM') ?? 'Insound <hello@getinsound.com>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RESEND_BATCH_MAX = 100;

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

type BroadcastBody = {
  subject: string;
  html: string;
  text?: string;
  include_overflow?: boolean;
  dry_run?: boolean;
  limit?: number;
  from?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Shared-secret auth
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || token !== BROADCAST_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: BroadcastBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { subject, html, text, include_overflow, dry_run, limit, from } = body;
  if (!subject || !html) return json({ error: 'subject_and_html_required' }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Gather recipients
  const emails = new Set<string>();

  const pullTable = async (table: string) => {
    const { data, error } = await supabase.from(table).select('email');
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data ?? []) {
      const e = (row as { email?: string }).email?.trim().toLowerCase();
      if (e && /\S+@\S+\.\S+/.test(e)) emails.add(e);
    }
  };

  try {
    await pullTable('waitlist');
    if (include_overflow) await pullTable('waitlist_overflow');
  } catch (err) {
    return json({ error: 'list_fetch_failed', detail: String(err) }, 500);
  }

  let recipients = Array.from(emails);
  if (typeof limit === 'number' && limit > 0) recipients = recipients.slice(0, limit);

  if (dry_run) {
    return json({
      dry_run: true,
      recipient_count: recipients.length,
      sample: recipients.slice(0, 10),
    });
  }

  if (recipients.length === 0) return json({ sent: 0, failed: 0 });

  const fromHeader = from ?? BROADCAST_FROM;
  const plaintext = text ?? stripHtml(html);

  // Send via Resend batch endpoint, chunked at 100 per call
  let sent = 0;
  let failed = 0;
  const errors: Array<{ chunk: number; error: string }> = [];

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_MAX) {
    const chunk = recipients.slice(i, i + RESEND_BATCH_MAX);
    const payload = chunk.map((to) => ({
      from: fromHeader,
      to: [to],
      subject,
      html,
      text: plaintext,
    }));

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      sent += chunk.length;
    } else {
      failed += chunk.length;
      const errText = await res.text();
      errors.push({ chunk: i / RESEND_BATCH_MAX, error: errText.slice(0, 500) });
    }
  }

  return json({
    recipient_count: recipients.length,
    sent,
    failed,
    errors: errors.length ? errors : undefined,
  });
});

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
