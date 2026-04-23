const BRAND_ORANGE = '#F56D00';
const BG_DARK = '#0A0A0A';
const TEXT_WHITE = '#FAFAFA';
const TEXT_MUTED = '#A1A1AA';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type TemplateConfig = {
  heading: string;
  buttonLabel: string;
  footer: string;
};

const TEMPLATES: Record<string, TemplateConfig> = {
  signin: {
    heading: 'Click below to sign in.',
    buttonLabel: 'Sign in &rarr;',
    footer: "If you didn't request this, you can ignore this email.",
  },
  purchase: {
    heading: 'Your music is ready to listen.',
    buttonLabel: 'Listen now &rarr;',
    footer: "If you didn't request this, you can ignore this email.",
  },
  redeem: {
    heading: 'Your music is waiting.',
    buttonLabel: 'Listen now &rarr;',
    footer: "If you didn't request this, you can ignore this email.",
  },
  reverify: {
    heading: 'Confirm your identity to continue.',
    buttonLabel: 'Verify identity &rarr;',
    footer: "If you didn't request this, you can ignore this email.",
  },
};

export type EmailTemplate = keyof typeof TEMPLATES;

export function buildMagicLinkEmail(
  actionUrl: string,
  template: EmailTemplate,
  meta?: { releaseTitle?: string; artistName?: string },
): { subject: string; html: string } {
  const config = TEMPLATES[template];

  let heading = config.heading;
  if (template === 'purchase' && meta?.releaseTitle && meta?.artistName) {
    heading = `${escapeHtml(meta.releaseTitle)} by ${escapeHtml(meta.artistName)} is ready to listen.`;
  }

  const subject =
    template === 'signin'
      ? 'Sign in to Insound'
      : template === 'purchase'
        ? 'Your music is ready'
        : template === 'reverify'
          ? 'Verify your identity'
          : 'Your music is waiting';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG_DARK};font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DARK};padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:${BRAND_ORANGE};letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:${TEXT_WHITE};font-size:18px;line-height:1.6;padding-bottom:32px;">
          ${heading}
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${actionUrl}" style="display:inline-block;background:${BRAND_ORANGE};color:${TEXT_WHITE};font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            ${config.buttonLabel}
          </a>
        </td></tr>
        <tr><td style="color:${TEXT_MUTED};font-size:13px;line-height:1.5;">
          ${config.footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
