// Triggered by pg_cron every minute.
// Finds deletion requests past execute_at, processes full deletion.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';
const DOWNLOAD_GRANT_EXPIRY_HOURS = 48;
const DOWNLOAD_GRANT_MAX_USES = 10;
const ARTIST_CONTENT_RETAIN_DAYS = 90;

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
    .select('id, user_id, user_type')
    .eq('cancelled', false)
    .eq('executed', false)
    .lte('execute_at', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let processed = 0;
  for (const request of requests) {
    try {
      // Re-check cancelled status (race condition guard)
      const { data: fresh } = await admin
        .from('account_deletion_requests')
        .select('cancelled')
        .eq('id', request.id)
        .single();

      if (fresh?.cancelled) continue;

      const { data: { user } } = await admin.auth.admin.getUserById(request.user_id);
      if (!user) {
        await markExecuted(admin, request.id);
        continue;
      }
      const userEmail = user.email!;

      // ── ARTIST DELETION STEPS ────────────────────────────
      if (request.user_type === 'artist') {
        await processArtistDeletion(admin, request.user_id, request.id);
      }

      // ── FAN DELETION STEPS ───────────────────────────────

      // 1. Generate download grants for all purchases
      const downloadLinks = await generateDownloadGrants(admin, request.user_id);

      // 2. Anonymise purchases
      await admin
        .from('purchases')
        .update({ buyer_user_id: null, buyer_email: 'deleted@anonymised' })
        .eq('buyer_user_id', request.user_id);

      // 3. Delete fan_profiles (cascades: fan_preferences, fan_pinned_releases, fan_badges, fan_hidden_purchases)
      await admin
        .from('fan_profiles')
        .delete()
        .eq('id', request.user_id);

      // 4. Delete avatar from storage
      const { data: avatarFiles } = await admin.storage
        .from('avatars')
        .list(request.user_id);

      if (avatarFiles && avatarFiles.length > 0) {
        await admin.storage
          .from('avatars')
          .remove(avatarFiles.map(f => `${request.user_id}/${f.name}`));
      }

      // 5. Delete auth user
      await admin.auth.admin.deleteUser(request.user_id);

      // 6. Send deletion complete email
      await sendDeletionCompleteEmail(userEmail, downloadLinks);

      // 7. Mark as executed
      await markExecuted(admin, request.id);

      processed++;
    } catch (e) {
      console.error(`Deletion failed for request ${request.id}:`, (e as Error).message);
      await admin.from('webhook_errors').insert({
        event_type: 'account_deletion',
        event_id: request.id,
        payload: { user_id: request.user_id, user_type: request.user_type },
        error: (e as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ processed }));
});

async function processArtistDeletion(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
) {
  // 1. Cancel active pre-orders and refund
  const { data: preorderPurchases } = await admin
    .from('purchases')
    .select('id, stripe_pi_id, buyer_email, amount_pence, releases!inner(id, title, preorder_enabled, cancelled)')
    .eq('artist_id', userId)
    .eq('status', 'paid')
    .eq('pre_order', true)
    .eq('releases.preorder_enabled', true)
    .eq('releases.cancelled', false);

  const refundEmails: { to: string; release: string; amount: number }[] = [];

  for (const p of preorderPurchases ?? []) {
    if (p.stripe_pi_id) {
      try {
        await stripe.refunds.create({ payment_intent: p.stripe_pi_id });
        await admin.from('purchases').update({ status: 'refunded' }).eq('id', p.id);
        if (p.buyer_email && p.buyer_email !== 'deleted@anonymised') {
          const release = Array.isArray(p.releases) ? p.releases[0] : p.releases;
          refundEmails.push({
            to: p.buyer_email,
            release: (release as any)?.title ?? 'Unknown',
            amount: p.amount_pence,
          });
        }
      } catch (e) {
        console.error(`Refund failed for purchase ${p.id}:`, (e as Error).message);
        await admin.from('deletion_requests').update({
          status: 'failed',
          error: `Refund failed for purchase ${p.id}: ${(e as Error).message}`,
        }).eq('id', requestId);
        return;
      }
    }
  }

  // Send refund notification emails
  if (refundEmails.length > 0) {
    const emailBatch = refundEmails.map(r => ({
      from: 'Insound <noreply@getinsound.com>',
      to: [r.to],
      subject: 'Your pre-order has been refunded',
      html: buildRefundEmail(r.release, r.amount),
    }));

    try {
      await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailBatch),
      });
    } catch (e) {
      console.error('Refund emails failed:', (e as Error).message);
    }
  }

  // 2. Mark all releases as deleted with 90-day retention
  const retainUntil = new Date(Date.now() + ARTIST_CONTENT_RETAIN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin
    .from('releases')
    .update({ visibility: 'deleted', deletion_retain_until: retainUntil })
    .eq('artist_id', userId);

  // 3. Anonymise artist sales records (keep financial data)
  await admin
    .from('purchases')
    .update({ buyer_email: 'deleted@anonymised', buyer_user_id: null })
    .eq('artist_id', userId)
    .neq('buyer_email', 'deleted@anonymised');

  // 4. Delete artist posts + post-media storage
  await admin.from('artist_posts').delete().eq('artist_id', userId);
  const { data: postMedia } = await admin.storage.from('post-media').list(userId);
  if (postMedia && postMedia.length > 0) {
    await admin.storage.from('post-media').remove(postMedia.map(f => `${userId}/${f.name}`));
  }

  // 5. Check Stripe balance and disconnect if possible
  const { data: account } = await admin
    .from('artist_accounts')
    .select('stripe_account_id')
    .eq('id', userId)
    .maybeSingle();

  if (account?.stripe_account_id) {
    // Store stripe_account_id on deletion request before deleting artist_accounts
    await admin
      .from('account_deletion_requests')
      .update({ stripe_account_id: account.stripe_account_id })
      .eq('id', requestId);

    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: account.stripe_account_id,
      });
      const totalAvailable = balance.available.reduce((s, b) => s + b.amount, 0);
      const totalPending = balance.pending.reduce((s, b) => s + b.amount, 0);

      if (totalAvailable === 0 && totalPending === 0) {
        await stripe.accounts.del(account.stripe_account_id);
      } else {
        await admin
          .from('account_deletion_requests')
          .update({ stripe_pending_disconnect: true })
          .eq('id', requestId);
      }
    } catch (e) {
      console.error('Stripe disconnect check failed:', (e as Error).message);
      await admin
        .from('account_deletion_requests')
        .update({ stripe_pending_disconnect: true })
        .eq('id', requestId);
    }
  }

  // 6. Delete artist_accounts and artists rows
  await admin.from('artist_accounts').delete().eq('id', userId);
  await admin.from('artists').delete().eq('id', userId);
}

async function generateDownloadGrants(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ releaseTitle: string; token: string }[]> {
  const { data: purchases } = await admin
    .from('purchases')
    .select('id, releases(title)')
    .eq('buyer_user_id', userId)
    .eq('status', 'paid');

  if (!purchases || purchases.length === 0) return [];

  const expiresAt = new Date(Date.now() + DOWNLOAD_GRANT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  const grants: { releaseTitle: string; token: string }[] = [];

  for (const p of purchases) {
    const token = crypto.randomUUID();
    const { error } = await admin
      .from('download_grants')
      .upsert(
        { purchase_id: p.id, token, expires_at: expiresAt, used_count: 0, max_uses: DOWNLOAD_GRANT_MAX_USES },
        { onConflict: 'purchase_id' }
      );

    if (!error) {
      const release = Array.isArray(p.releases) ? p.releases[0] : p.releases;
      grants.push({ releaseTitle: (release as any)?.title ?? 'Unknown', token });
    }
  }

  return grants;
}

async function sendDeletionCompleteEmail(
  email: string,
  downloadLinks: { releaseTitle: string; token: string }[],
) {
  const linksHtml = downloadLinks.length > 0
    ? `<tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:24px;">
        Your download links are active for 48 hours:
      </td></tr>` +
      downloadLinks.map(l =>
        `<tr><td style="padding-bottom:8px;">
          <a href="${SITE_URL}/download/${l.token}" style="color:#F56D00;font-size:14px;text-decoration:none;">
            ${escapeHtml(l.releaseTitle)} &rarr;
          </a>
        </td></tr>`
      ).join('')
    : '';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [email],
        subject: 'Your Insound account has been deleted',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your Insound account has been permanently deleted.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:24px;">
          All your personal data has been removed from our systems.
        </td></tr>
        ${linksHtml}
        <tr><td style="padding-top:16px;">
          <a href="${SITE_URL}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Visit Insound &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    });
  } catch (e) {
    console.error('Deletion complete email failed:', (e as Error).message);
  }
}

async function markExecuted(admin: ReturnType<typeof createClient>, requestId: string) {
  await admin
    .from('account_deletion_requests')
    .update({ executed: true, executed_at: new Date().toISOString() })
    .eq('id', requestId);
}

function buildRefundEmail(releaseTitle: string, amountPence: number): string {
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your pre-order has been refunded.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          The artist has closed their account. Your pre-order for <strong style="color:#FAFAFA">${escapeHtml(releaseTitle)}</strong> has been cancelled and a full refund of ${amount} has been issued. It should appear in your account within 5&ndash;10 business days.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/explore" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Discover more music &rarr;
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
