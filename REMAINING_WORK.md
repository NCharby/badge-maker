# SD Platform — Remaining Work to MVP 1

**Generated:** March 2026 | **Last updated:** April 2026
**Audit basis:** Full QA/PM regression of codebase as of March 2026; April 2026 documentation sync (analytics & accounting module; refund & cancellation system)

This document tracks all outstanding work required before the MVP 1 target (May Ticket Opening). Items are prioritized by whether they block launch or can be completed in parallel.

---

## Tier 1 — Blockers (must complete before launch)

### 1. Telegram Bot Webhook Handler

**Status:** Not started
**File to create:** `src/app/api/telegram/webhook/route.ts`

`grammY` is installed but no webhook route exists. The bot cannot receive any messages or commands.

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Bot, webhookCallback } from 'grammy'

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to the Lekd bot. ...')
})

// Route inbound help-desk messages to Odoo (stub until Odoo is connected)
bot.on('message:text', async (ctx) => {
  // TODO: Odoo Help Desk routing — not implemented
  await ctx.reply('Your message has been received. Our team will follow up via email.')
})

const handler = webhookCallback(bot, 'std/http')

export async function POST(request: NextRequest) {
  return handler(request)
}
```

After creating the file: register the webhook URL with Telegram by running `scripts/register-telegram-webhook.sh`.

---

### 2. Hotel Weekly Report Endpoint

**Status:** Not started
**File to create:** `src/app/api/reports/hotel-weekly/route.ts`

Required for §6.3 (weekly automated hotel email). Must be callable by an external scheduler.

**Implementation guidance:**
- Accept `event_id` query param or loop all active events
- Query `event_attendees` joined with `rooms` and `platform_users` for locked attendees
- Generate Excel (`.xlsx`) using `exceljs` and PDF using existing `lib/pdf.ts`
- Compare against last week's snapshot (store in a `report_snapshots` table or Supabase Storage)
- Highlight changes in yellow in the Excel file; summarize in email body
- Send via Resend to `platform_events.hotel_contact_email ?? venues.email`
- Must return 200 (scheduler needs a success signal)

---

### 3. Offline Reporting Packet Endpoint

**Status:** Not started
**File to create:** `src/app/api/reports/offline-packet/route.ts`

Required for §10. Triggered by external scheduler after event transitions to `Event Locked`.

**Implementation guidance:**
- Accept `event_id` query param; validate it exists and is in `Event Locked` status
- Generate multi-tab Excel (`.xlsx`) with tabs: Attendee Room List, Room Lock Status, Volunteer Schedule, Event Schedule
- Email to EP (`platform_events.owner_id` → `platform_users.email`) via Resend
- Store generated file in Supabase Storage for re-download from EP panel
- Column spec per §10

---

### 4. Odoo Integration (Waiver Module)

**Status:** Blocked on Odoo API credentials
**Stub locations:**
- `src/lib/odoo/` (or wherever Odoo client is scaffolded)
- Waiver status sync in `src/app/(platform)/events/[event-id]/waiver/`

No implementation possible until Odoo deployment URL, auth mechanism, and endpoint details are provided. All integration points are marked `// TODO: Odoo integration — not implemented`.

**Pre-work that can be done now:**
- Scaffold `src/lib/odoo/client.ts` with a typed interface matching the expected Odoo API contract (to be filled in when credentials arrive)
- Create the waiver module page shell that shows "Waiver signing coming soon" until the integration is live

---

### 5. External Scheduler Configuration

**Status:** Not started — required for Tier 2 notifications and Tier 1 reporting

Rows 12, 13, 17–21, and 23 of the notification inventory (§6.12) require an external scheduler calling a Route Handler. The Offline Reporting Packet (§10) also requires it.

**Options (pick one):**
- **Supabase Edge Functions with pg_cron** — cron schedule triggers an edge function that calls the Route Handler
- **Zapier** — existing paid subscription; Webhooks by Zapier can call the Route Handler on a schedule
- **GitHub Actions** — scheduled workflow that hits the production URL

**Route Handlers to create (once scheduler is chosen):**
- `POST /api/notifications/send-lock-reminders` — rows 12 and 13 (1 week and 48h before lock-in)
- `POST /api/notifications/send-volunteer-reminders` — rows 17–21 (shift timing reminders)
- `POST /api/reports/hotel-weekly` — row 23 (already in Tier 1 above)

---

## Tier 2 — Significant (required for full feature completion)

### 6. Email Delivery — All Notification Rows

**Status:** All `// TODO: send email` stubs
**Pattern:** Use Resend (`RESEND_API_KEY`) via `src/lib/email.ts`

Every Server Action that fires an in-platform notification also has a `// TODO: send email` comment. Email sends need to be wired for:

| Row | Trigger location | Template content |
|---|---|---|
| 4 | `application/actions.ts` — `submitApplication` | Applicant name, event title, link to EP attendee detail |
| 5 | `application/actions.ts` — `submitApplication` (re-submit) | Same as row 4 |
| 6 | `rooms/actions.ts` — `selectRoom` | Event name, room number, room type, check-in/check-out |
| 7 | `rooms/actions.ts` — `applyForRoom` | Applicant name, event title, room/spot, review link |
| 8 | `rooms/actions.ts` — `acceptApplication` | Event name, room number, room type |
| 9 | `rooms/actions.ts` — `declineApplication` / `acceptApplication` (superseded) | Event name |
| 10 | `events/[event-id]/actions.ts` — `signalReadyToLock` | User name, event title |
| 14 | `ep/attendees/[user-id]/actions.ts` — `updateApplicationStatus` (Locked) | Event name, lock confirmation |
| 15 | `ticket/actions.ts` — `purchaseTicket` | Ticket type, event name, amount paid, order ID, Roommate Code if applicable |
| 16 | `ticket/actions.ts` — `selfCancelTicket` | Refund amount (or no-refund), event name, order ID |
| 29 | `rooms/actions.ts` — `claimRoommateByEmail` | Room Lead name, room name/number, event name |
| 30 | `rooms/actions.ts` — `acceptInvitation` | Acceptor name, event name, room number |
| 31 | `rooms/actions.ts` — `declineInvitation` | Decliner name, event name |
| 32 | `ticket/actions.ts` — `purchaseTicket` (roommate code used) | Roommate name, event name, room number |
| 33 | `ticket/validateRoommateCode.ts` | Event name, room number (room full attempt) |
| `application_approved` | `ep/attendees/[user-id]/actions.ts` | Event name, next steps |
| `application_declined` | `ep/attendees/[user-id]/actions.ts` | Event name |
| 34 | `rooms/actions.ts` — `roomLeadSendLockRequest` | Room Lead name, room name/number, event name |
| 35 | `rooms/actions.ts` — `acceptLockRequest` | Acceptor name, event name, room number |
| 36 | `rooms/actions.ts` — `declineLockRequest` | Decliner name, event name, room number |
| 37 | `events/[event-id]/refund/actions.ts` — `requestStandardRefund` | Refund amount, percentage, event name, order ID (user email); EP notification of refund |
| 38 | `events/[event-id]/refund/actions.ts` — `submitHardshipRequest` | User scene name, event name, reason excerpt (to EP) |
| 39 | `ep/events/[event-id]/attendees/[user-id]/actions.ts` — `approveHardshipRequest` | Approved refund amount, event name, EP note |
| 40 | `ep/events/[event-id]/attendees/[user-id]/actions.ts` — `denyHardshipRequest` | Event name, EP note |

**Implementation pattern** (add after each `createInPlatformNotification` call):
```typescript
// TODO: send email — replace with Resend call
// await sendEmail({ to: userEmail, subject: '...', body: '...' })
```

---

### 7. Telegram Outbound Sends — All Notification Rows

**Status:** Zero outbound Telegram messages sent anywhere in the platform
**Dependency:** Telegram webhook handler (Tier 1 item 1) must exist first

Once the bot is active, wire outbound sends for:

| Row | Recipient | Where |
|---|---|---|
| 7 | Room Lead | `rooms/actions.ts` — `applyForRoom` |
| 8 | Roommate | `rooms/actions.ts` — `acceptApplication` |
| 9 | Roommate | `rooms/actions.ts` — `declineApplication` |
| 14 | Locked user | `ep/attendees/[user-id]/actions.ts` |
| 25 | All event attendees | Event status transition action |
| 26 | New attendee | First enrollment action |
| 29 | Claimed user | `rooms/actions.ts` — `claimRoommateByEmail` |
| 32 | Room Lead | `ticket/actions.ts` — `purchaseTicket` |
| 33 | Room Lead | `ticket/validateRoommateCode.ts` |
| 34 | Occupant | `rooms/actions.ts` — `roomLeadSendLockRequest` |
| 35 | Room Lead | `rooms/actions.ts` — `acceptLockRequest` |
| 36 | Room Lead | `rooms/actions.ts` — `declineLockRequest` |

**Implementation pattern:**
```typescript
import { sendTelegramMessage } from '@/lib/telegram/send'
// sendTelegramMessage(telegramHandle, message) — only if user.telegram_verified && user.telegram_notifications_enabled
```

Create `src/lib/telegram/send.ts` if it doesn't exist:
```typescript
export async function sendTelegramMessage(handle: string, message: string) {
  if (!handle) return
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: `@${handle}`, text: message }),
  })
}
```

---

## Tier 3 — Moderate (should complete before launch)

### 9. Telegram Handle Verification Flow

**Status:** Not implemented
**Spec:** §5 platform_users schema — `telegram_verified: boolean`, `telegram_notifications_enabled: boolean`

**Flow:**
1. User saves a Telegram handle on their profile
2. Platform generates a random 6-digit code and stores it temporarily (in the user's profile or a short-lived DB record)
3. Bot sends a DM to the handle: "Your verification code is: 123456"
4. User enters the code in the platform → `telegram_verified = true`, `telegram_notifications_enabled = true`

**Files to create/modify:**
- `src/app/(platform)/profile/actions.ts` — `verifyTelegramHandle(code)` Server Action
- `src/lib/telegram/send.ts` — `sendTelegramMessage()` (also needed for Tier 2)

---

### 10. Hotel Map Image Upload

**Status:** Not implemented
**Spec:** §6.3 — EP uploads a static floor plan image; displayed above the room selection grid

**Implementation:**
- Add image upload field to EP event configuration (venue or rooms settings page)
- Store URL in `platform_events.module_config` JSONB under a `hotel_map_image_url` key, or a dedicated column
- Display above the Roommate Finder grid when set

---

### 11. Room-Required-at-Purchase Room Assignment Verification

**Status:** Needs verification
**Concern:** When `room_required_at_purchase = true`, the checkout flow inserts room selection before payment. After `purchaseTicket` completes, the attendee's `room_id` and `room_status = 'Selected'` should be set. Verify that `purchaseTicket` in `src/app/(platform)/events/[event-id]/ticket/actions.ts` handles this case correctly and that the room lock is released after assignment.

---

### 12. Roommate Code on Ticket Status Card

**Status:** Needs verification
**Spec:** §6.2a — Room Lead sees their code on the ticket status card in the event attendee portal

Check that `src/app/(platform)/events/[event-id]/page.tsx` (or the ticket status card component) reads `event_attendees.roommate_code` and displays it when set.

---

## Security — Completed March 2026

The following security issues were identified in the QA audit and have been fixed:

| Issue | Severity | Fix Applied |
|---|---|---|
| `/api/test` and `/api/test-db` exposed service role key validity and DB content | HIGH | Routes deleted |
| `/api/telegram/test`, `test-connection`, `test-bot-permissions` leaked bot token prefix, group IDs | HIGH | Routes deleted |
| `/app/test-telegram/` page exposed bot config and created real Telegram invite links | HIGH | Page deleted |
| `/api/events/[slug]` returned `telegram_config` (Telegram group IDs) to unauthenticated callers | MEDIUM | `telegram_config` removed from response |
| `registerDevUser` gated only by `NEXT_PUBLIC_DEBUG` (public env var, baked at build) | MEDIUM | Server action now requires server-only `DEBUG_REGISTRATION_KEY` env var |

### Completed — April 2026

| Change | Details |
|---|---|
| Platform branded "Lekd" | Nav, auth pages, metadata, Telegram bot, copyright footer — all user-facing strings updated |
| Copyright footer | Added to root layout |
| Private bucket fix | `badge-images` and `waiver-documents` use signed URLs at display time; storage paths stored instead of public URLs |
| Waiver PDF viewing | Users can view their signed waiver PDF on their waiver page |
| Profile page restructured | Single-column accordion layout; warning cards; address fields removed; first/last name added |
| `first_name` / `last_name` columns | Migration `20260401000003`; `PlatformUser` type; registration form (required); auth callback; profile page |
| Emergency contact fields | Migration `20260401000002`; `emergency_contact` and `emergency_phone` on `platform_users` |
| Profile completeness gate | `src/lib/profile-completeness.ts` — first_name, last_name, emergency_contact, emergency_phone required before event enrollment; enforced in `submitApplication()` and `purchaseTicket()` |
| Room locking system | Migration `20260401000004` — `user_locked`, `room_lead_locked` on `event_attendees`; `room_lock_requests` table; Server Actions: `userSelfLock`, `roomLeadSendLockRequest`, `acceptLockRequest`, `declineLockRequest`, `epLockRoom`, `epUnlockRoom` |
| Room locking EP config | `module_config` fields `room_lead_can_lock` and `room_lead_can_lock_with_open_spots`; toggles in EP module config page |
| Room locking UI | Event hub card colors (red/amber/blue/green); room detail page lock management; rooms page hides grid when user locked |
| New notification types | `room_lock_request` (row 34), `room_lock_request_accepted` (row 35), `room_lock_request_declined` (row 36) — in-platform delivery wired |
| Puppeteer fix | `require('puppeteer')` instead of ESM import for compatibility |
| Badge confirmation fix | Removed client-side success state; uses `router.refresh()` |
| Documentation agent | `.claude/agents/documentation.md` created |
| Analytics & Accounting module | Migration `20260402000015` adds `refund_channel` to `orders`; `src/lib/analytics/` (types, format, queries); event accounting at `/ep/events/[event-id]/accounting` (Excel export, two-tab layout); org analytics at `/org/[org-slug]/analytics`; admin analytics at `/admin/analytics`; Recharts added as dependency |
| Refund & Cancellation system | Migration `20260402000016` — `hardship_requests` table; `src/lib/refunds.ts` (pure utility functions); `requestStandardRefund` Server Action (fully automatic — percentage calc → payment API → order update → ticket reset → EP notify); `submitHardshipRequest` / `approveHardshipRequest` / `denyHardshipRequest` Server Actions; `RefundButton` client component (adaptive: standard %, hardship request, or pending badge); EP attendees list refund column + hardship badge; EP attendee detail hardship review card; `updateCancellationPolicy` extended for hardship config; `isStatusReferenced()` extended for hardship boundaries; template apply re-maps hardship UUIDs; 4 new notification types (rows 37–40) added to `src/lib/notifications.ts` |

**Known gaps in the Analytics & Accounting module:**
- **PDF export not wired** — `/ep/events/[event-id]/accounting` Excel export works; PDF download is not yet implemented.
- **Daily Event Views deferred** — Page view tracking (Feature 3 from analytics PRD) requires a new `event_page_views` table, a client-side beacon, and a privacy review. Deferred to a future phase; no implementation exists.

### Remaining Security Recommendations (not yet addressed)

| Issue | Severity | Recommendation |
|---|---|---|
| `/api/badges` and `/api/events/[slug]` use service role key where anon key would suffice | LOW | Switch to anon key; badge-maker tables have public RLS so behavior is identical but using service role bypasses any future policy additions |
| `/api/pdf` GET returns full PII (DOB, emergency contact) for any waiver UUID without auth | MEDIUM | Legacy waiver flow is deprecated (Odoo handles waivers). Consider removing the GET endpoint or gating it with admin auth. The POST is part of the active badge-maker flow and should remain. |

---

## Summary

| Tier | Count | Status |
|---|---|---|
| Tier 1 — Blockers | 5 items | Not started |
| Tier 2 — Significant | 2 items | `// TODO` stubs (email and Telegram sends; now includes rows 37–40 for email) |
| Tier 3 — Moderate | 4 items | Not started / needs verification |
| Security (completed Mar 2026) | 5 fixes | Done |
| Completed Apr 2026 | 18 items | Done (branding, profile, room locking, storage, bug fixes, analytics & accounting, refund & cancellation system) |
| Analytics gaps | 2 items | PDF export not wired; daily event views deferred |
| Security (recommended) | 2 items | Optional hardening |

**Estimated state:** ~88% of MVP 1 functionality is implemented. The platform is feature-complete for the happy-path ticket/room/volunteer/application/room-locking flows and now includes financial analytics and a full refund & cancellation system (standard automatic refunds and EP-reviewed hardship cancellations). The gaps are primarily in outbound communication (email, Telegram), reporting endpoints, and the Telegram bot receive path.
