const BRAND_ORANGE = '#F56D00'
const BG_DARK = '#0A0A0A'
const TEXT_WHITE = '#FAFAFA'
const TEXT_MUTED = '#A1A1AA'
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, `<h3 style="color:${TEXT_WHITE};font-size:18px;font-weight:700;margin:24px 0 8px;">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="color:${TEXT_WHITE};font-size:20px;font-weight:700;margin:24px 0 8px;">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="color:${TEXT_WHITE};font-size:24px;font-weight:700;margin:24px 0 8px;">$1</h1>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${BRAND_ORANGE};text-decoration:underline;">$1</a>`)
    .replace(/\n\n/g, '</p><p style="margin:0 0 16px;line-height:1.6;">')
    .replace(/\n/g, '<br>')
}

export function buildBroadcastHtml(bodyMarkdown: string): string {
  const bodyHtml = markdownToHtml(escapeHtml(bodyMarkdown))

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG_DARK};font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DARK};padding:60px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:40px;">
          <span style="font-size:24px;font-weight:900;color:${BRAND_ORANGE};letter-spacing:-0.5px;">insound.</span>
        </td></tr>
        <tr><td style="color:${TEXT_WHITE};font-size:16px;">
          <p style="margin:0 0 16px;line-height:1.6;">${bodyHtml}</p>
        </td></tr>
        <tr><td style="padding-top:40px;border-top:1px solid rgba(255,255,255,0.08);margin-top:40px;">
          <p style="color:${TEXT_MUTED};font-size:12px;line-height:1.5;margin:0;">
            You're receiving this because you're part of the Insound community.<br>
            <a href="{{unsubscribe_url}}" style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
