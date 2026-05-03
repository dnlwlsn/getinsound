import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildMagicLinkEmail, type EmailTemplate } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com';

const VALID_TEMPLATES: EmailTemplate[] = ['signin', 'purchase', 'redeem', 'reverify'];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email as string)?.trim()?.toLowerCase();
  const redirectTo = body.redirectTo as string | undefined;
  const template = (body.template as EmailTemplate) || 'signin';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  if (!VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
  }

  const ip = getClientIp(req.headers)
  const hashedIp = await hashIp(ip)
  const ipLimited = await checkRateLimit(hashedIp, 'magic_link', 10, 1)
  if (ipLimited) return ipLimited

  const rateLimited = await checkRateLimit(email, 'magic_link', 3, 1)
  if (rateLimited) return rateLimited

  const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : undefined;

  const { data: linkData, error: linkErr } = await getAdminClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: safeRedirect ? `${SITE_URL}${safeRedirect}` : `${SITE_URL}/welcome`,
    },
  });

  if (linkErr) {
    console.error('Magic link generation failed:', linkErr.message);
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }

  const nextPath = safeRedirect || '/welcome';
  const callbackPath = `/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const magicLink = `${SITE_URL}${callbackPath}&token_hash=${tokenHash}&type=magiclink`;

  const { subject, html } = buildMagicLinkEmail(magicLink, template);
  const result = await sendEmail(email, subject, html);

  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
