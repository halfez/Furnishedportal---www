# furnishedportal-www — Deploy Notes

This repo is a **static site** (`index.html`, `onboarding/index.html`) plus **one Vercel serverless function** (`api/stripe-webhook.js`) that automates post-payment.

## What ships here

| File / folder | What it does |
|---|---|
| `index.html` | The marketing site at `furnishedportal.com` |
| `onboarding/index.html` | The questionnaire at `furnishedportal.com/onboarding` (sent in welcome email) |
| `api/stripe-webhook.js` | Listens to Stripe `checkout.session.completed` → sends Resend welcome email |
| `api/_email-templates/welcome.js` | The HTML + text body of the welcome email |
| `package.json` | Declares `stripe` + `resend` deps so Vercel installs them |
| `vercel.json` | `cleanUrls` + `trailingSlash` config |
| `.env.example` | Template — real values go in Vercel project settings, never commit `.env` |

## One-time setup checklist

### 1. Push to GitHub
```bash
cd furnishedportal-www
git add .
git commit -m "Add Stripe webhook + onboarding route + welcome email"
git push
```
Vercel will auto-deploy on push (assuming GitHub integration is set up).

### 2. Set Vercel environment variables
Vercel → Project → Settings → Environment Variables. Add the four required vars from `.env.example`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` *(get this in step 4)*
- `RESEND_API_KEY`
- `WELCOME_FROM_EMAIL` (e.g. `FurnishedPortal <support@furnishedportal.com>`)

Optional but recommended:
- `WELCOME_BCC_EMAIL=admin@furnishedportal.com` (so you see every welcome email go out)
- The four `STRIPE_PRICE_*` vars so the email mentions the plan name

### 3. Verify domain in Resend
Resend dashboard → Domains → Add Domain → `furnishedportal.com`. Resend gives you 3 DNS records (TXT/MX). Add them in Spaceship DNS. Wait for verified status (usually <10 min). Without this, emails will not send.

### 4. Create the Stripe webhook endpoint
Stripe dashboard → Developers → Webhooks → Add endpoint:
- **URL:** `https://furnishedportal.com/api/stripe-webhook`
- **Events:** `checkout.session.completed` (just that one)
- After creating, click "Reveal" on the **Signing secret** (`whsec_...`) and paste it into Vercel as `STRIPE_WEBHOOK_SECRET`. **Redeploy** so the new env var takes effect.

### 5. Smoke test
- Stripe dashboard → Developers → Webhooks → click your endpoint → "Send test webhook" → pick `checkout.session.completed`
- Vercel → your project → Deployments → latest → Functions → `/api/stripe-webhook` logs should show `welcome email sent to ...`
- Or do a real test-mode checkout via one of your Payment Links and confirm a welcome email lands in the inbox you used.

## Notes
- v1 does NOT write to Neon DB — the welcome email is the only side effect. Adding a DB row is a 30-min follow-up once the webhook is proven.
- v1 does NOT use tokenized URLs — `/onboarding` is public. Anyone could fill the form, but submissions go to `support@furnishedportal.com` so you can match them against Stripe customers manually for now.
- The questionnaire's existing EmailJS submission still works exactly as before — this deploy doesn't change it.
