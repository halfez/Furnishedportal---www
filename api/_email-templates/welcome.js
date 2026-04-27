// Welcome email — sent by api/stripe-webhook.js on checkout.session.completed.
// Plain HTML + text. No React, no MJML — keeps the function bundle small.

const QUESTIONNAIRE_URL = 'https://furnishedportal.com/onboarding';
const SUPPORT_EMAIL = 'support@furnishedportal.com';

function buildHtml({ firstName, planLabel }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Welcome,';
  const planLine = planLabel
    ? `Your <strong>${escapeHtml(planLabel)}</strong> subscription is active.`
    : 'Your subscription is active.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Welcome to FurnishedPortal</title>
</head>
<body style="margin:0;padding:0;background:#F3F3F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F3F3;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#1F6FEB;padding:28px 32px;color:#FFFFFF;">
              <div style="font-size:13px;letter-spacing:0.6px;text-transform:uppercase;opacity:0.85;">Welcome aboard</div>
              <div style="font-size:22px;font-weight:600;margin-top:6px;">FurnishedPortal</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px;line-height:1.55;margin:0 0 16px 0;">${greeting}</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;color:#3A3A3A;">${planLine} Thanks for joining FurnishedPortal — we're ready to start building your midterm rental site.</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0;color:#3A3A3A;">The next step is a quick onboarding questionnaire. It takes about <strong>10 minutes</strong> and covers everything we need to design your site:</p>
              <ul style="font-size:15px;line-height:1.7;margin:0 0 24px 0;padding-left:20px;color:#3A3A3A;">
                <li>Property basics (address, beds, baths, amenities)</li>
                <li>Photos &amp; media</li>
                <li>House rules</li>
                <li>FAQ for guests</li>
                <li>Final config (logo, brand colors)</li>
              </ul>
              <p style="font-size:15px;line-height:1.6;margin:0 0 28px 0;color:#3A3A3A;">The more detail you give us, the more polished your site will be on day one.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background:#1F6FEB;border-radius:6px;">
                    <a href="${QUESTIONNAIRE_URL}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Start the questionnaire →</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;line-height:1.6;margin:32px 0 0 0;color:#666666;text-align:center;">Or paste this link into your browser:<br><span style="color:#1F6FEB;word-break:break-all;">${QUESTIONNAIRE_URL}</span></p>
            </td>
          </tr>
          <tr>
            <td style="background:#FAFAFA;padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);font-size:13px;line-height:1.55;color:#666666;">
              Questions? Just reply to this email — it goes straight to the team.<br>
              <span style="color:#999999;">— FurnishedPortal · ${SUPPORT_EMAIL}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText({ firstName, planLabel }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Welcome,';
  const planLine = planLabel ? `Your ${planLabel} subscription is active.` : 'Your subscription is active.';
  return [
    greeting,
    '',
    `${planLine} Thanks for joining FurnishedPortal — we're ready to start building your midterm rental site.`,
    '',
    'The next step is a quick onboarding questionnaire. It takes about 10 minutes and covers:',
    '  - Property basics (address, beds, baths, amenities)',
    '  - Photos & media',
    '  - House rules',
    '  - FAQ for guests',
    '  - Final config (logo, brand colors)',
    '',
    'The more detail you give us, the more polished your site will be on day one.',
    '',
    `Start the questionnaire: ${QUESTIONNAIRE_URL}`,
    '',
    'Questions? Just reply to this email — it goes straight to the team.',
    '',
    `— FurnishedPortal · ${SUPPORT_EMAIL}`,
  ].join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  subject: 'Welcome to FurnishedPortal — let\'s build your site',
  buildHtml,
  buildText,
};
