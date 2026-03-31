# Resend Email Setup

The platform uses [Resend](https://resend.com) for all transactional email delivery. This covers:
- Auth emails (account confirmation, password reset) — routed through Supabase SMTP
- Platform notification emails (ticket purchased, room accepted, attendance slips, reports) — sent directly via `src/lib/email.ts`

---

## Environment Variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API key from Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@shinydog.events`) |

Set these in `.env.local` for local development and in Hostinger hPanel → Node.js App → Environment Variables for production.

---

## One-Time Setup

### 1. Create a Resend account

Go to [resend.com](https://resend.com) and sign up. The free tier allows 3,000 emails/month and 100/day — sufficient for early platform usage.

### 2. Add and verify your sending domain

1. Resend Dashboard → **Domains** → **Add Domain**
2. Enter your domain (e.g. `shinydog.events`)
3. Resend will display DNS records to add — typically:
   - An SPF `TXT` record
   - A DKIM `TXT` record
   - An MX record (optional but recommended for replies)
4. Add these records at your domain registrar
5. Return to Resend and click **Verify** — DNS propagation takes up to 48 hours

You must send from an address on a verified domain. Until verification is complete, you can use Resend's shared `onboarding@resend.dev` domain for testing only.

### 3. Create an API key

1. Resend Dashboard → **API Keys** → **Create API Key**
2. Name it (e.g. `SD Platform Production`)
3. Set permission to **Sending access** (no need for full access)
4. Copy the key immediately — it is only shown once

### 4. Add env vars locally

In `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@shinydog.events
```

---

## Configure Supabase to Send Auth Emails via Resend

Supabase sends auth emails (account confirmation, password reset, email change) through its own SMTP pipeline. By default it uses Supabase's shared mailer, which has low deliverability and strict rate limits. Pointing it at Resend's SMTP relay gives you full deliverability on your own domain.

### Steps

1. **Resend Dashboard → Settings → SMTP** — note the credentials:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS/STARTTLS)
   - Username: `resend`
   - Password: your `RESEND_API_KEY`

2. **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**:

   | Field | Value |
   |---|---|
   | Enable custom SMTP | On |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key |
   | Sender email | `noreply@shinydog.events` |
   | Sender name | `SD Platform` |

3. **Supabase Dashboard → Authentication → Providers → Email**:
   - Enable **Confirm email** — requires users to click a verification link before signing in

4. Test by registering a new account through `/register` in production mode (not the dev path). The confirmation email should arrive from `noreply@shinydog.events` within seconds.

---

## Production Deployment Checklist

Before deploying to Hostinger:

- [ ] Domain verified in Resend (DNS records confirmed)
- [ ] `RESEND_API_KEY` set in hPanel → Environment Variables
- [ ] `RESEND_FROM_EMAIL` set in hPanel → Environment Variables
- [ ] Supabase SMTP configured with Resend credentials
- [ ] "Confirm email" enabled in Supabase Auth settings

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are server-only variables (no `NEXT_PUBLIC_` prefix). They are not baked at build time — set them any time before restart.

---

## Testing Email Delivery

A test page is available at `/test-email` (dev only — accessible when `NEXT_PUBLIC_DEBUG=true`):

1. **Check Email Configuration** — calls `GET /api/email`; verifies the Resend client can reach the API
2. **Test Waiver Email** — generates a real PDF and sends it to a hardcoded test address with attachment

To test auth email delivery specifically, register a new account through `/register` (production path, not the dev bypass) and verify the confirmation email arrives.

---

## How Email Sending Works in the Codebase

All email goes through `src/lib/email.ts`. The key export is:

```typescript
sendEmail(emailData: EmailData): Promise<EmailResult>
```

Where `EmailData` is:
```typescript
{
  To: string
  From: string
  Subject: string
  HtmlBody: string
  TextBody: string
  Attachments?: EmailAttachment[]  // { Name, Content (base64), ContentType }
}
```

Higher-level functions (`sendWaiverConfirmationEmail`, `sendBadgeConfirmationEmail`, etc.) build the `EmailData` and call `sendEmail`. Report handlers (`/api/reports/hotel-weekly`, `/api/reports/offline-packet`) also call `sendEmail` directly.

The `From` address in all calls defaults to `process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'`. The fallback is intentionally non-functional — always set `RESEND_FROM_EMAIL` in every environment.
