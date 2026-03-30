# SD Platform — Database Reset & Seed Guide

This document covers how to apply migrations to the remote Supabase project, reset data for fresh workflow testing, and seed the database with test accounts and event data.

> **WARNING:** These procedures destroy and recreate data. Never run the data-truncation SQL on the production database.

---

## Prerequisites

**1. Supabase CLI installed**
```powershell
npx supabase --version
```

If not installed:
```powershell
npm install -g supabase
```

**2. Project linked to remote Supabase**

The CLI must know which remote project to push migrations to:
```powershell
npx supabase link --project-ref <your-project-ref>
```

The project ref is the identifier in your Supabase dashboard URL:
`https://supabase.com/dashboard/project/<project-ref>`

You will be prompted for the database password. This only needs to be done once per machine.

**3. `.env.local` populated**

The seed script reads credentials directly from `.env.local`. Populate from the Supabase Dashboard → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

---

## Applying Migrations to the Remote Database

Use this when new migration files have been added (e.g., after pulling from `main`, or after creating new migrations in a session).

```powershell
npx supabase db push
```

This compares the remote `supabase_migrations.schema_migrations` history against the files in `supabase/migrations/` and applies any files not yet recorded. Safe to run repeatedly — already-applied migrations are skipped.

**When to run:**
- After pulling changes that include new `.sql` files in `supabase/migrations/`
- After creating a new migration file yourself
- After initial setup of a new Supabase project
- After any session where Claude added new migration files (check the session output)

**Verify in Supabase Dashboard:**
After pushing, go to Table Editor → confirm the expected tables exist and the new columns are present.

---

## Full Data Reset (Fresh Testing State)

There is no `db reset` command for a remote Supabase project. To wipe all platform data and return to a clean seed state, run the following truncation script in the Supabase SQL Editor.

**Supabase Dashboard → SQL Editor → New query → paste and run:**

```sql
-- SD Platform — Data Truncation Script
-- Clears all platform data while preserving schema and badge-maker tables.
-- Run this before re-seeding for a fresh workflow test.
-- CASCADE handles FK dependencies automatically.

TRUNCATE TABLE
  platform_notifications,
  roommate_applications,
  user_volunteer_signups,
  volunteer_shifts,
  schedule_activities,
  application_responses,
  application_forms,
  locks,
  bed_blocks,
  event_room_config,
  merchandise,
  order_items,
  orders,
  ticket_types,
  ticket_groups,
  event_attendees,
  platform_events,
  rooms,
  venues
CASCADE;

-- Clear platform user profiles (keep auth.users — re-seeding recreates platform_users rows)
TRUNCATE TABLE platform_users CASCADE;

-- Clear Supabase Auth users so seed can recreate them fresh
-- (service role required — run only in Dashboard SQL Editor or via service role client)
DELETE FROM auth.users;
```

> **Note on `auth.users`:** The SQL Editor in the Supabase Dashboard runs with superuser privileges and can delete from `auth.users`. This removes the actual login accounts so the seed can recreate them from scratch. If you skip this step, the seed script will detect the existing accounts and skip re-creating them (it warns but continues), which is fine for data-only resets.

After running the truncation, proceed to seed.

---

## Running the Seed

```powershell
npm run seed
```

The seed script:
1. Creates 4 auth accounts (skips any that already exist)
2. Creates corresponding `platform_users` profile rows
3. Creates the test venue, 10 rooms, both platform events, ticket types, merchandise, volunteer shifts, application form, and 2 blocked room entries

The script is idempotent — all inserts use `upsert` with fixed UUIDs. Safe to re-run without truncating first if you only want to restore missing data without clearing everything.

**Expected output (clean run):**
```
════════════════════════════════════════════════
  SD Platform — Development Seed Script
════════════════════════════════════════════════

── Phase 1: Badge-Maker Tables ──────────────────
  ✓ Default template upserted
  ✓ Badge-maker event: test-full-event
  ✓ Badge-maker event: test-minimal-event
  ✓ Created: admin@test.local (System Administrator)
  ✓ Created: promoter@test.local (Event Promoter)
  ✓ Created: user1@test.local (User)
  ✓ Created: user2@test.local (User)

── Phase 2: Platform Tables ─────────────────────
  ✓ platform_user: admin@test.local (system_admin)
  ✓ platform_user: promoter@test.local (event_promoter)
  ...
  ✓ Phase 2 complete.
```

If Phase 2 prints `⚠ Platform tables not yet available` — migrations have not been pushed. Run `npx supabase db push` first.

**Verify in Supabase Dashboard → Table Editor:**
- `platform_users` → 4 rows
- `platform_events` → 2 rows (Full Test Event, Minimal Test Event)
- `venues` → 1 row (Test Venue)
- `rooms` → 10 rows
- `event_room_config` → 2 rows (KS-101 and KS-102 blocked)

---

## Migration Inventory

All migrations apply in this order. `db push` applies only those not yet in the remote migration history.

| File | What it does |
|---|---|
| `00000000000000_baseline.sql` | Badge-maker schema (events, templates, sessions, waivers, badges, analytics, telegram_invites) |
| `20260101000000_create_platform_users.sql` | `platform_users` — all user profile data, roles, Telegram, notification prefs |
| `20260101000001_create_venues.sql` | `venues` |
| `20260101000002_create_rooms.sql` | `rooms` — venue-scoped and event-scoped rooms |
| `20260101000003_create_platform_events.sql` | `platform_events` — event config, JSONB workflow_statuses and module_config |
| `20260101000004_create_event_attendees.sql` | `event_attendees` — per-attendee module statuses |
| `20260101000005_create_ticket_types_and_groups.sql` | `ticket_types` and `ticket_groups` |
| `20260101000006_create_orders.sql` | `orders` and `order_items` |
| `20260101000007_create_merchandise.sql` | `merchandise` |
| `20260101000008_create_event_room_config.sql` | `event_room_config` — blocking, reservation, room open group |
| `20260101000009_create_bed_blocks.sql` | `bed_blocks` — per-bed capacity reduction |
| `20260101000010_create_locks.sql` | `locks` — soft locks (ticket, room, shift, merchandise) |
| `20260101000011_create_application_forms.sql` | `application_forms` and `application_responses` |
| `20260101000012_create_schedule_activities.sql` | `schedule_activities` |
| `20260101000013_create_volunteer_shifts.sql` | `volunteer_shifts` and `user_volunteer_signups` |
| `20260101000014_create_roommate_applications.sql` | `roommate_applications` |
| `20260101000015_rls_policies.sql` | All RLS policies for platform tables |
| `20260101000016_functions_and_triggers.sql` | Postgres functions and triggers (AUTO-{n} room numbering, updated_at, etc.) |
| `20260101000017_add_roommate_codes.sql` | `event_attendees.roommate_code` + partial unique index |
| `20260101000018_venue_enhancements.sql` | Venue enhancement columns |
| `20260101000019_venue_rls_and_constraints.sql` | Venue RLS additions and constraints |
| `20260101000020_event_scoped_rooms.sql` | Support for event-scoped rooms (`rooms.event_id`) |
| `20260101000021_fix_rls_gaps.sql` | `bed_blocks` UPDATE policy; EP SELECT policy on `platform_users` |
| `20260101000022_create_platform_notifications.sql` | `platform_notifications` — in-platform notification inbox |
| `20260101000023_notifications_restrict_update.sql` | RLS: users can only UPDATE `is_read` and `dismissed_at` on own rows |
| `20260329000000_orders_refund_ids.sql` | Adds `processed_refund_ids TEXT[]` to `orders` — Square webhook dedup |
| `20260330000001_add_offline_report_flag.sql` | Adds `pending_offline_report BOOLEAN` to `platform_events` |
| `20260330000002_telegram_verification.sql` | Adds `telegram_verification_code` and `telegram_verification_expires_at` to `platform_users` |

---

## Seed Data Reference

### Accounts

| Email | Password | Role | Notes |
|---|---|---|---|
| `admin@test.local` | `Admin1234!` | System Administrator | Full platform access |
| `promoter@test.local` | `Promo1234!` | Event Promoter | Owns both test events; `payment_provider = 'square'` |
| `user1@test.local` | `User1234!` | User | Not enrolled in any event |
| `user2@test.local` | `User1234!` | User | Not enrolled in any event |

All accounts have `date_of_birth` set to 30 years before the current date. Email verification is bypassed via `email_confirm: true` in `auth.admin.createUser()`.

No attendee records are pre-seeded. Use `user1` and `user2` to walk through the full workflow from scratch.

### Venue

**Test Venue** (`id: aaaaaaaa-0000-0000-0000-000000000001`)
- Address: 123 Test Street, Test City, TX 75001
- Hotel contact email: `hotel@test.local`

### Rooms

| Room # | Name | Lodging | Spots | Min | Group | Status |
|---|---|---|---|---|---|---|
| KS-101 | King Studio | Studio | 2 | 1 | King Studios | **Blocked** (Staff) |
| KS-102 | King Studio | Studio | 2 | 1 | King Studios | **Blocked** (Playroom) |
| KS-103 | King Studio | Studio | 2 | 1 | King Studios | Available |
| QD-201 | Queen Double | Suite | 2 | 2 | Queen Doubles | Available |
| QD-202 | Queen Double | Suite | 2 | 2 | Queen Doubles | Available |
| QD-203 | Queen Double | Suite | 2 | 2 | Queen Doubles | Available |
| QD-204 | Queen Double | Suite | 2 | 2 | Queen Doubles | Available |
| BK-301 | Bunk Room | Shared | 4 | 2 | Bunk Rooms | Available |
| BK-302 | Bunk Room | Shared | 4 | 2 | Bunk Rooms | Available |
| BK-303 | Bunk Room | Shared | 4 | 2 | Bunk Rooms | Available |

Nightly rates (Full Test Event, Oct 1–5, check-in nights Thu/Fri/Sat):
- King Studio: $200 / $225 / $225
- Queen Double: $175 / $195 / $195
- Bunk Room: $100 / $115 / $115

### Full Test Event

**id:** `aaaaaaaa-0000-0000-0000-000000000002` | **slug:** `test-full-event`
**Dates:** October 1–5, 2026 | **Current status:** `Tickets Open` | **Venue:** Test Venue

**Workflow statuses (custom intermediate, in order):**
1. Applications Open → 2. Applications Closed → 3. Tickets Open ← current → 4. Tickets Closed → 5. Rooms Open → 6. Rooms Closed

**Module configuration:**

| Module | Enabled | Required | Opens at |
|---|---|---|---|
| Application | Yes | Yes | Applications Open |
| Ticketing | Yes | Yes | Tickets Open |
| Waiver | Yes | Yes | Tickets Open |
| Room Selection | Yes | No | Rooms Open |
| Volunteering | Yes | No | Tickets Open |
| Schedule | Yes | No | Published |
| Badge | Yes | No | Tickets Open |

**Ticket types (all $0):**

| Name | Room Lead | Roommate Codes | Vol. Hrs Required |
|---|---|---|---|
| Room Lead Pass | Yes | Yes | 0 |
| Roommate Pass | No | — | 0 |
| Volunteer Pass | No | — | 4 |

**Merchandise:**

| Name | Restriction |
|---|---|
| Event T-Shirt | None |
| VIP Lanyard | Room Lead Pass only |

**Volunteer shifts:**

| Name | Start | Duration | Cap | Notes |
|---|---|---|---|---|
| Registration Desk | Oct 1 10:00 UTC | 60 min | 5 | Overlaps Welcome Booth |
| Welcome Booth | Oct 1 10:30 UTC | 60 min | 3 | Overlaps Registration Desk |
| Afternoon Activities | Oct 2 14:00 UTC | 90 min | 4 | |
| Evening Cleanup | Oct 2 17:00 UTC | 90 min | 4 | |

Registration Desk + Welcome Booth intentionally overlap to test the overlap constraint. Afternoon Activities + Evening Cleanup together = 3 hours; all four non-overlapping shifts = 4 hours exactly (satisfying Volunteer Pass requirement).

**Cancellation policy:** 100% refund at Applications Open → 50% refund at Tickets Open

**Room lock-in date:** September 1, 2026 | **Room closed date:** September 15, 2026

### Minimal Test Event

**id:** `aaaaaaaa-0000-0000-0000-000000000003` | **slug:** `test-minimal-event`
**Dates:** November 1–3, 2026 | **Status:** `Tickets Open`

Ticketing module only. One ticket type: General Admission ($0). No venue, no Roommate Code step.

---

## Known Gap: CLAUDE.md Checklist vs. Actual Seed State

The verification checklist in `CLAUDE.md §13` references `user1` pre-seeded with a Room Lead ticket and a `roommate_code = 'TESTRL'`. **The seed script does not create this state.** All users start unenrolled.

To test the Roommate Code flow, you must first purchase a Room Lead Pass as `user1` through normal checkout — a code is generated automatically at that point. Use that dynamically generated code in subsequent roommate checkout tests.

---

## Workflow Testing Flows

Walk these in order after a fresh reset + seed. Each flow depends on the prior ones.

### Flow 1 — Account Registration

1. Navigate to `/register`
2. Attempt to register with a DOB under 21 → verify rejection
3. Register a new account with valid DOB → verify email verification prompt appears
4. Confirm in Supabase Dashboard → Authentication → Users that the account exists unverified

### Flow 2 — Login & Portal Landing

1. Log in as `user1@test.local` / `User1234!`
2. Portal landing page should show no event cards (unenrolled)
3. Navigate to `/events/test-full-event` — verify Event Detail View (not attendee hub)
4. Ticketing module is open (status is `Tickets Open`); Application module opened at `Applications Open` (an earlier status) so it is now in `closed` state — visible read-only on the hub

### Flow 3 — Room Lead Ticket Purchase (user1)

1. As `user1`, begin checkout for Full Test Event → select **Room Lead Pass**
2. No Roommate Code step should appear (Room Lead buyer, not a Roommate)
3. Merchandise step: verify both items appear (lanyard restriction is met by Room Lead Pass)
4. Complete purchase ($0)
5. In Dashboard → `event_attendees`: verify `is_room_lead = true`, `ticket_status = 'Complete'`
6. Verify `roommate_code` is a 6-char uppercase value (e.g. `X3K9R7`) — visible on the portal ticket card
7. In Dashboard → `platform_notifications`: verify row 15 (ticket_purchased) created for user1

### Flow 4 — Roommate Ticket Purchase (user2)

1. As `user2`, begin checkout → select **Roommate Pass**
2. **Roommate Code step appears** (event has Room Lead ticket type with codes enabled)
3. Before user1 selects a room: enter user1's code → verify error "Your Room Lead has not selected a room yet"
4. Skip the code step → complete checkout
5. Verify `event_attendees` row with `is_room_lead = false`, no `room_id`

### Flow 5 — Room Selection (user1 as Room Lead)

1. As `user1`, open the Rooms module
2. Verify Roommate Finder shows 8 rooms (10 minus 2 blocked: KS-101, KS-102)
3. Select KS-103 → confirm
4. Verify `room_id = ROOM_KS3`, `room_status = 'Selected'` in `event_attendees`
5. Verify notification row 6 (room_lead_confirmed) in `platform_notifications`

### Flow 6 — Roommate Code (user2 uses user1's code)

1. As `user2`, navigate back to checkout or start a fresh checkout flow on a new test account
2. Enter user1's Roommate Code during the code step
3. Verify room confirmation card: KS-103, "TestUser1" as Room Lead, nightly pricing
4. Confirm → complete checkout
5. Verify `user2.room_id = ROOM_KS3`, `room_status = 'Selected'`
6. Verify notification row 32 (roommate_code_used) created for user1

### Flow 7 — Roommate Finder Application (standard apply flow)

1. As `user2` (no room assigned), browse Roommate Finder → apply for a spot in KS-103
2. Verify `roommate_applications` row with `status = 'pending'`
3. Verify notification row 7 (roommate_applied) created for user1
4. As `user1`, accept the application
5. Verify `user2.room_id = ROOM_KS3`, notification row 8 (room_application_accepted) for user2

### Flow 8 — Room Lead Claim by Email

1. As `user1`, open "Find a Roommate" panel on the room detail page
2. Enter `user2@test.local` → verify notification row 29 (room_claim_received) created for user2
3. As `user2`, accept from the portal → verify notification row 30 (room_claim_accepted) for user1

### Flow 9 — Volunteer Signups

1. Register a third account and purchase a **Volunteer Pass** (4 hrs required)
2. Verify hours countdown shows "0 of 4 required hours"
3. Sign up for Registration Desk (1h) → countdown updates
4. Attempt Welcome Booth (overlaps) → verify rejection
5. Sign up for Afternoon Activities (1.5h) + Evening Cleanup (1.5h) → total 4h
6. Verify countdown shows "4 of 4 required hours"

### Flow 10 — Area Lead Label

1. As EP (`promoter@test.local`), go to volunteer management for Full Test Event
2. Assign Area Lead label to a confirmed signup
3. Verify notification row 27 (area_lead_assigned) created for the volunteer
4. Remove label → verify notification row 28 (area_lead_removed)

### Flow 11 — Ready to Lock → Lock

1. As `user1`, signal "Ready to Lock" from the event hub
2. Verify `lock_status = 'Ready to Lock'`; notification row 10 created for EP
3. As EP, lock user1 from the attendee detail page
4. Verify `lock_status = 'Locked'`; notification row 14 created for user1
5. As `user1`, verify room selection is no longer editable

### Flow 12 — Self-Cancel Ticket

1. As `user2` (ticket purchased), cancel from the ticket module
2. Verify cancellation policy evaluated (50% refund at current `Tickets Open` status)
3. Verify `ticket_status = 'Incomplete'`, order `status = 'partial_refund'`
4. Verify notification row 16 (refund_processed) created for user2

### Flow 13 — EP Room Blocking

1. As EP, block QD-201 with note "Test Block"
2. Verify QD-201 disappears from Roommate Finder immediately
3. Unblock → verify it reappears

### Flow 14 — Bed Blocking

1. As EP, block bed #1 in BK-301 (4-spot room)
2. Verify Roommate Finder shows 3 open spots for BK-301
3. Verify `bed_blocks` row in Dashboard

### Flow 15 — Notification Inbox

1. As `user1`, navigate to `/notifications`
2. Verify all notifications from prior flows are listed newest-first
3. Unread rows show green left border
4. Dismiss one → verify it disappears
5. Verify AppNav bell badge count decrements correctly

### Flow 16 — Telegram Handle Verification

> Requires `TELEGRAM_BOT_TOKEN` set and the webhook registered. The bot cannot DM a user until that user has sent `/start` to the bot first.

1. As `user1`, navigate to `/profile` → add a Telegram handle → save
2. In Dashboard `platform_users`: verify `telegram_verified = false`, `telegram_notifications_enabled = false`
3. Click "Send verification code" → verify bot DMs a 6-digit code to the Telegram account
4. Enter the code → click "Verify"
5. In Dashboard: verify `telegram_verified = true`, `telegram_notifications_enabled = true`
6. Profile page shows "Verified" badge
7. Change the handle to a different value → save → verify `telegram_verified` resets to `false`

### Flow 17 — Admin: User Management

1. Log in as `admin@test.local` → navigate to `/admin/users`
2. Verify all 4 seed accounts are listed with correct role badges
3. Promote a user to Event Promoter → verify; demote back → verify
4. Attempt to modify the admin's own role → verify it is blocked

### Flow 18 — Permissions Boundary

1. As `user2`, attempt to access `user1`'s profile directly via URL
2. Verify no PII (email, DOB, phone, address) is exposed — only Roommate Finder card data
3. Attempt `/ep/events/...` as a regular user → verify 403 or redirect

### Flow 19 — Minimal Test Event

1. As `user1`, purchase General Admission on the Minimal Test Event
2. Verify Roommate Code step does NOT appear
3. Verify the event hub shows only the Ticketing module card

---

## Troubleshooting

**`npx supabase db push` fails with "project not linked"**
```powershell
npx supabase link --project-ref <your-project-ref>
```

**`npm run seed` fails with "NEXT_PUBLIC_SUPABASE_URL must be set"**
`.env.local` is missing or not populated. Populate from Supabase Dashboard → Project Settings → API.

**`npm run seed` shows Phase 2 skipped with "Platform tables not yet available"**
Migrations have not been applied. Run `npx supabase db push` first.

**Seed shows `⚠ Already exists, skipping` for all accounts but platform_users is empty**
Auth users exist from a prior run but the `platform_users` truncation removed the profile rows. Run the truncation SQL again including `DELETE FROM auth.users`, then re-seed.

**Telegram verification code never arrives**
- The user must send `/start` to the bot before it can DM them — Telegram bots cannot initiate conversations
- Verify `TELEGRAM_BOT_TOKEN` in `.env.local` is correct
- Check Dashboard → Edge Functions logs or server logs for `sendMessage` errors
- Verify the webhook is registered; for local dev use ngrok + `scripts/register-telegram-webhook.ps1`

**Scheduler endpoints return 401**
`SCHEDULER_SECRET` must be in `.env.local`. Test manually:
```powershell
Invoke-WebRequest -Uri "https://<your-domain>/api/notifications/send-lock-reminders" `
  -Method POST `
  -Headers @{ Authorization = "Bearer <your-SCHEDULER_SECRET>" }
```
