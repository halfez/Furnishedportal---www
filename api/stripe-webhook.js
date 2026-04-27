// Stripe webhook handler — Vercel serverless function.
//
// Listens for `checkout.session.completed` events from Stripe Payment Links
// and sends the welcome email via Resend with a link to /onboarding.
//
// Required env vars (set in Vercel project settings):
//   STRIPE_SECRET_KEY        — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET    — Webhook signing secret (whsec_...) from Stripe
//                              dashboard → Developers → Webhooks → this endpoint
//   RESEND_API_KEY           — Resend API key (re_...)
//   WELCOME_FROM_EMAIL       — e.g. "FurnishedPortal <support@furnishedportal.com>"
//                              The domain must be verified in Resend.
//
// Optional:
//   WELCOME_BCC_EMAIL        — BCC every welcome email here (e.g. admin@...)
//   STRIPE_PRICE_HOST,
//   STRIPE_PRICE_PORTFOLIO,
//   STRIPE_PRICE_HOST_FOUNDING,
//   STRIPE_PRICE_PORTFOLIO_FOUNDING
//                            — Map Stripe price IDs to plan labels for the email.

const Stripe = require('stripe');
const { Resend } = require('resend');
const welcomeTemplate = require('./_email-templates/welcome');

// Vercel needs the raw body to verify Stripe's signature. Disable parsing.
module.exports.config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function planLabelFromPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_HOST) return 'Host';
  if (priceId === process.env.STRIPE_PRICE_PORTFOLIO) return 'Portfolio';
  if (priceId === process.env.STRIPE_PRICE_HOST_FOUNDING) return 'Host (Founding)';
  if (priceId === process.env.STRIPE_PRICE_PORTFOLIO_FOUNDING) return 'Portfolio (Founding)';
  return null;
}

function firstNameFrom(fullName) {
  if (!fullName) return null;
  const trimmed = String(fullName).trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate env at request time, not import time, so missing config
  //    surfaces in the function logs rather than crashing the build. ──
  const {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY,
    WELCOME_FROM_EMAIL,
    WELCOME_BCC_EMAIL,
  } = process.env;

  const missing = [];
  if (!STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!WELCOME_FROM_EMAIL) missing.push('WELCOME_FROM_EMAIL');
  if (missing.length) {
    console.error('[stripe-webhook] missing env vars:', missing.join(', '));
    return res.status(500).json({ error: 'Server misconfigured', missing });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const resend = new Resend(RESEND_API_KEY);

  // ── 1. Verify Stripe signature ──
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    console.warn('[stripe-webhook] missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[stripe-webhook] failed to read body:', err);
    return res.status(400).json({ error: 'Invalid body' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ── 2. Only react to checkout.session.completed ──
  if (event.type !== 'checkout.session.completed') {
    console.log('[stripe-webhook] ignoring event type:', event.type);
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object;

  // Pull customer details. Payment Links populate customer_details when the
  // checkout completes — even before a Stripe Customer record is attached.
  const customerEmail =
    session.customer_email ||
    (session.customer_details && session.customer_details.email) ||
    null;
  const customerName =
    (session.customer_details && session.customer_details.name) || null;
  const firstName = firstNameFrom(customerName);

  if (!customerEmail) {
    console.error('[stripe-webhook] checkout.session.completed without email; session:', session.id);
    // Still 200 — Stripe will keep retrying otherwise, and we can't recover
    // without an email anyway. Log and move on.
    return res.status(200).json({ received: true, error: 'no_email' });
  }

  // ── 3. Determine plan label (for the email body). Best-effort. ──
  let planLabel = null;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    planLabel = planLabelFromPriceId(priceId);
  } catch (err) {
    console.warn('[stripe-webhook] could not fetch line items:', err.message);
    // Email still sends; planLine just falls back to generic copy.
  }

  // ── 4. Send welcome email via Resend ──
  try {
    const { error } = await resend.emails.send({
      from: WELCOME_FROM_EMAIL,
      to: [customerEmail],
      bcc: WELCOME_BCC_EMAIL ? [WELCOME_BCC_EMAIL] : undefined,
      subject: welcomeTemplate.subject,
      html: welcomeTemplate.buildHtml({ firstName, planLabel }),
      text: welcomeTemplate.buildText({ firstName, planLabel }),
      reply_to: 'support@furnishedportal.com',
      tags: [
        { name: 'event', value: 'checkout_completed' },
        { name: 'session', value: session.id },
      ],
    });

    if (error) {
      console.error('[stripe-webhook] resend error:', error);
      // Return 500 so Stripe retries. Resend transient errors are common.
      return res.status(500).json({ error: 'email_send_failed', detail: error.message });
    }
  } catch (err) {
    console.error('[stripe-webhook] resend exception:', err);
    return res.status(500).json({ error: 'email_send_exception', detail: err.message });
  }

  console.log('[stripe-webhook] welcome email sent to', customerEmail, '(session', session.id + ')');
  return res.status(200).json({ received: true, emailed: customerEmail });
};
