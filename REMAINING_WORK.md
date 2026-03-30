# SD Platform — Remaining Work to MVP 1

**Generated:** March 2026
**Audit basis:** Full QA/PM regression of codebase as of March 2026

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
  await ctx.reply('Welcome to the SD Platform bot. ...')
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
- Send via Postmark to `platform_events.hotel_contact_email ?? venues.email`
- Must return 200 (scheduler needs a success signal)

---

### 3. Offline Reporting Packet Endpoint

**Status:** Not started
**File to create:** `src/app/api/reports/offline-packet/route.ts`

Required for §10. Triggered by external scheduler after event transitions to `Event Locked`.

**Implementation guidance:**
- Accept `event_id` query param; validate it exists and is in `Event Locked` status
- Generate multi-tab Excel (`.xlsx`) with tabs: Attendee Room List, Room Lock Status, Volunteer Schedule, Event Schedule
- Email to EP (`platform_events.owner_id` → `platform_users.email`) via Postmark
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
**Pattern:** Use Postmark (`POSTMARK_API_KEY`) via `src/lib/email.ts` (or create it if it doesn't exist)

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

**Implementation pattern** (add after each `createInPlatformNotification` call):
```typescript
// TODO: send email — replace with Postmark call
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

### 8. Refund Percentage Calculation in selfCancelTicket

**Status:** `// TODO: proper implementation` comment in `src/app/(platform)/events/[event-id]/ticket/actions.ts`
**What's missing:** The cancellation policy checkpoint lookup — find the most recently passed checkpoint (highest-order workflow status the event has reached) and apply its `refund_percentage`.

**Implementation guidance:**
1. Load `platform_events.cancellation_policy` and `platform_events.workflow_statuses` and `platform_events.status`
2. Find the current status position in `workflow_statuses` order
3. Filter checkpoints whose `status_id` corresponds to a workflow status with `order ≤ current_order`
4. Take the checkpoint with the highest order (most recently passed)
5. Apply `refund_percentage / 100 * subtotal` to compute the refund amount
6. If no checkpoint matched, refund percentage is 0 (no refund)

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
| Tier 2 — Significant | 3 items | `// TODO` stubs |
| Tier 3 — Moderate | 4 items | Not started / needs verification |
| Security (completed) | 5 fixes | Done |
| Security (recommended) | 2 items | Optional hardening |

**Estimated state:** ~75% of MVP 1 functionality is implemented. The platform is feature-complete for the happy-path ticket/room/volunteer/application flows. The gaps are primarily in outbound communication (email, Telegram), reporting, and the Telegram bot receive path.
