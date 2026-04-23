import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildMagicLinkEmail, type EmailTemplate } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';
import { checkRateLimit } from '@/lib/rate-limit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  if (!VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
  }

  const rateLimited = await checkRateLimit(email, 'magic_link', 3, 1)
  if (rateLimited) return rateLimited

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: redirectTo ? `${SITE_URL}${redirectTo}` : `${SITE_URL}/welcome`,
    },
  });

  if (linkErr) {
    console.error('Magic link generation failed:', linkErr.message);
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }

  const magicLink = linkData.properties?.action_link;
  if (!magicLink) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }

  const { subject, html } = buildMagicLinkEmail(magicLink, template);
  const result = await sendEmail(email, subject, html);

  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
