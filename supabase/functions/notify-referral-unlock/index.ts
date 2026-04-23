import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response('user_id required', { status: 400 });

    const { data: profile } = await admin
      .from('fan_profiles')
      .select('referral_count, first_year_zero_fees')
      .eq('id', user_id)
      .single();

    if (!profile?.first_year_zero_fees || profile.referral_count < 5) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { data: userData } = await admin.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;
    if (!email) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

    const { data: artist } = await admin
      .from('artists')
      .select('id')
      .eq('id', user_id)
      .maybeSingle();

    const ctaUrl = artist ? `${SITE_URL}/dashboard` : `${SITE_URL}/become-an-artist`;
    const ctaLabel = artist ? 'Go to dashboard' : 'Start selling';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:32px;">
          <span style="color:#F56D00;font-size:24px;font-weight:900;letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:#FAFAFA;font-size:22px;font-weight:700;line-height:1.3;padding-bottom:16px;">
          You've unlocked zero Insound fees.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.7;padding-bottom:32px;">
          5 friends joined. You've unlocked 0% Insound fees for your first year of selling — starting from your first sale. Stripe's processing fee still applies, but our 10% is waived for 12 months. Thank you for spreading the word.
        </td></tr>
        <tr><td>
          <a href="${ctaUrl}" style="display:inline-block;background:#F56D00;color:#000;font-size:14px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.5px;text-transform:uppercase;">
            ${ctaLabel} &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [email],
        subject: "You've unlocked zero Insound fees.",
        html,
      }),
    });

    if (!res.ok) {
      console.error('Resend failed:', await res.text());
      return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 500 });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
