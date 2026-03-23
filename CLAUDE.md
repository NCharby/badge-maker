# SD Platform — CLAUDE.md
## AI-Assisted Development Reference Document
**Organization:** Shiny Dog Productions Inc.
**Document Status:** Revised Draft — Gap analysis complete; all schemas, notifications, and workflows specified
**Last Updated:** March 2026 (gap analysis revision)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Stack & Architecture](#2-technical-stack--architecture)
3. [Badge Maker Integration (Existing Codebase)](#3-badge-maker-integration-existing-codebase)
4. [External Services & Integrations](#4-external-services--integrations)
5. [Data Models](#5-data-models)
   - [Permissions Matrix](#permissions-matrix)
6. [Module Specifications](#6-module-specifications)
7. [User Workflows](#7-user-workflows)
8. [Event Promoter Workflows](#8-event-promoter-workflows)
9. [User Stories](#9-user-stories)
10. [Reporting Requirements](#10-reporting-requirements)
11. [MVP Scope](#11-mvp-scope)
12. [Open Questions & Notes](#12-open-questions--notes)
13. [Development Seed & Verification](#13-development-seed--verification)

---

## 1. Project Overview

The SD Platform is a event management platform developed by Shiny Dog Productions. The platform is a white-box solution for event promoters to build and manage the event and all aspects of the event.

### Goals

- Streamline the full attendee lifecycle: application → ticketing → room selection → check-in
- Reduce manual admin overhead for event coordination
- Provide automated hotel communication and reporting
- Support a small, high-trust adult community with appropriate access controls (21+ age verification)
- Build a foundation extensible toward broader event/community platform features

### Platform Topology (Target State)

```
SD Platform
  ├── Event Creation and Management
  ├── Badge Maker
  ├── Schedule
  ├── Volunteering
  ├── Hotel Room Selection
  ├── Attendee Portal
  │   ├── Profile Management
  │   └── Messaging and Notifications
  ├── Event Promoter Panel
  └── System Administrator Panel

Odoo (Third-Party)
  ├── Help Desk / Email Intake & Resolution  → replaces FreshDesk
  ├── CRM                                    → replaces ActiveCampaign
  ├── Email Marketing                        → replaces ActiveCampaign
  └── Waiver                                 → replaces badge-maker waiver workflow

Other (not connected to SD Platform)
  ├── GSuite (Email, Docs, Drive)
  └── Canva (Design)
```

All Odoo services connect to the SD Platform via API.

---

## 2. Technical Stack & Architecture

The new platform is built as an extension of the existing badge-maker Next.js codebase. The badge maker is a feature module within the new platform, not a separate system.

### Core Stack (Inherited from badge-maker)

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth & RLS | Supabase Auth + Row Level Security |
| State Management | Zustand with persistence |
| Form Validation | React Hook Form + Zod |
| PDF Generation | Puppeteer |
| Email Delivery | Postmark |
| Telegram | Bot API |
| Storage | Supabase Storage with RLS |
| Payments | Square (primary); PayPal (required addition — see §6.2) |
| Node.js | 20.x LTS — pinned via `.nvmrc` at repo root |
| Deployment | Hostinger Node.js Web Apps (Business or Cloud plan) — GitHub integration via hPanel; push to `main` triggers auto-redeploy |
| Containerization | Docker / docker-compose — **development only**; not used in production |

### Component Structure

```
src/
├── app/                        # Next.js App Router
│   ├── [event-name]/           # Dynamic event routes
│   └── api/                    # API endpoints
├── components/                 # Atomic Design
│   ├── atoms/                  # Basic UI elements
│   ├── molecules/              # Compound components
│   ├── organisms/              # Complex components
│   └── pages/                  # Page-level components
├── hooks/                      # Custom React hooks
├── lib/                        # Utility functions
└── types/                      # TypeScript definitions
```

### API Conventions

| Pattern | When to Use |
|---|---|
| **Server Actions** | All user-facing form mutations (application submission, profile updates, room selection confirmation, lock signals, etc.) |
| **Route Handlers** (`/api/[resource]`) | External webhooks and integrations: Square, PayPal, Telegram Bot, Odoo |

- **Route naming:** `/api/[resource]` — plural noun, kebab-case (e.g., `/api/volunteer-shifts`); no versioning for MVP
- **Error envelope:** All Route Handler error responses use `{ error: string, code?: string }` with the appropriate HTTP status code
- **Auth pattern:** All Server Actions and Route Handlers validate the session via Supabase Auth before processing; unauthenticated requests return 401
- Existing badge-maker Route Handler patterns must be preserved where they already exist

---

### Database Schema (Existing — badge-maker)

**Baseline:** `supabase/schema.sql` on the `master` branch of the badge-maker repository is the confirmed production state (verified December 2025). There are no separate migration files — the schema is a single unified file. This file must be preserved as-is and treated as read-only reference.

**Migration convention for new platform tables:**
- All new tables must be added via timestamped migration files in `supabase/migrations/` (Supabase standard convention)
- Never modify `supabase/schema.sql`
- Never add columns to or alter existing badge-maker tables

**Migration baseline strategy:**
The badge-maker `supabase/schema.sql` must be wrapped into a baseline migration file so that `supabase db reset` produces a clean, fully-ordered local dev environment:
- `supabase/migrations/00000000000000_baseline.sql` — contains the full content of `supabase/schema.sql`; created once and never modified
- All subsequent platform migrations are timestamped files that come after the baseline (e.g., `20260101000000_create_platform_users.sql`)
- `supabase db reset` applies `00000000000000_baseline.sql` first, then all platform migrations in timestamp order
- The original `supabase/schema.sql` is retained at the repo root as read-only reference; it is not applied directly in any dev or CI workflow — `00000000000000_baseline.sql` is the authoritative source for local dev

Core tables defined in `supabase/schema.sql` (see §3 for full inventory and platform treatment):

- `events` — badge-maker event config; slug-based; **≠ new platform Event model**
- `templates` — badge template configurations (JSONB)
- `sessions` — anonymous single-use badge-maker sessions; **≠ user auth sessions**
- `waivers` — legacy waiver data (waiver now handled by Odoo)
- `badges` — created badge records
- `analytics` — badge-maker usage metrics
- `telegram_invites` — Telegram invite link tracking

> **RLS note:** All badge-maker tables use permissive public RLS (public INSERT/SELECT/UPDATE/DELETE). Do not modify these policies. New platform tables must implement role-based RLS per the Permissions Matrix in §5.

**RLS Pattern Blocks for New Platform Tables**

Platform roles are stored in a `platform_users` table (`id UUID FK → auth.users`, `role TEXT CHECK (role IN ('user', 'event_promoter', 'system_admin'))`). This table backs all platform accounts and extends Supabase Auth with profile data and role assignment.

All new platform migrations compose RLS policies from these reusable building blocks:

| Block | Label | Expression |
|---|---|---|
| A | User owns row | `auth.uid() = user_id` |
| B | Is System Administrator | `(SELECT role FROM platform_users WHERE id = auth.uid()) = 'system_admin'` |
| C | Is Event Promoter or System Administrator | `(SELECT role FROM platform_users WHERE id = auth.uid()) IN ('event_promoter', 'system_admin')` |
| D | EP owns the event referenced by this row | `EXISTS (SELECT 1 FROM platform_events WHERE id = event_id AND owner_id = auth.uid())` |
| E | Caller is an attendee of the event referenced by this row | `EXISTS (SELECT 1 FROM event_attendees WHERE event_id = [table].event_id AND user_id = auth.uid())` |

Composition patterns by table type:

| Table type | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| User-owned data (profile, own attendee record) | A OR B | A | A OR B | A OR B |
| Event-scoped data (volunteer signups, room selections, locks) | A OR D OR B | A | A OR D OR B | A OR D OR B |
| Event metadata (readable by attendees) | E OR D OR B | D OR B | D OR B | D OR B |
| Venue / Room data | C OR B | D OR B | D OR B | D OR B |

New platform tables will be added via `supabase/migrations/` (see §3).

### Environment Variables

**Local dev:** stored in `.env.local` (gitignored, never committed to source control).
**Production:** set manually in hPanel → Node.js App → Environment Variables. Never use `.env.production` as a committed file — secrets go in hPanel only.
**Important:** `NEXT_PUBLIC_*` variables are baked at build time. They must be set in hPanel *before* deploying, not after.

```
# Supabase (existing — from badge-maker)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email
POSTMARK_API_KEY=
POSTMARK_FROM_EMAIL=

# Telegram
TELEGRAM_BOT_TOKEN=

# App (required for production)
NEXT_PUBLIC_APP_URL=https://yourdomain.com   # set in hPanel before deploy; baked at build time

# Runtime (Hostinger-managed — do not set manually in production)
NODE_ENV=production
PORT=                                         # injected by Hostinger automatically
```

Additional environment variables will be required for Square, PayPal, Odoo, and other integrations.

### Development Setup

```bash
git clone <repository-url>
cd badge-maker
npm install
cp .env.example .env.local
# Populate .env.local
npm run dev
# App at http://localhost:3000/default/landing
```

**Telegram bot in local development:**
The bot runs in webhook mode requiring a public HTTPS URL. For local Telegram testing:
1. Run `ngrok http 3000` to expose localhost publicly
2. Register the ngrok URL as the temporary webhook: `scripts/register-telegram-webhook.sh`
3. The grammY library requires no code changes for dev vs. prod — only the registered webhook URL changes
4. Never commit the ngrok URL; re-register on each local dev session

### Hostinger Deployment Constraints

> **These constraints apply to all code Claude Code writes. Violations will cause deployment failures or silent runtime errors.**

**Required: `next.config.mjs`**
```js
const nextConfig = {
  output: 'standalone',
}
```
Without `output: 'standalone'`, Hostinger deployment fails or produces a broken app.

**Required: `package.json` start script**
```json
"start": "next start -p $PORT"
```
Hostinger injects `PORT` at runtime. Never hardcode `3000` in production code paths.

**Required: `.nvmrc` at repo root**
```
20
```
Pins Node.js to 20.x on both Docker and Hostinger.

**Required: static asset copy after `next build`**
```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```
The standalone server does not copy `public/` or `.next/static/` by default — these steps must be included in the build process.

**File structure:** Hostinger deploys to `/home/{username}/domains/{domain}/nodejs` — not `public_html`. Never write code that assumes the app is served from `public_html` or that static assets live at a relative path from the process root.

**Hard constraints — Claude Code must respect all of the following:**

| Constraint | Rule |
|---|---|
| No Docker in production | Hostinger manages builds and runs directly. Docker is dev-only. |
| No persistent filesystem writes | Never write files to disk at runtime (logs, uploads, temp files). All file I/O must use Supabase Storage. |
| No background workers or cron jobs | Hostinger managed hosting does not support persistent background processes. Scheduled tasks (e.g., weekly hotel email) must use an external scheduler — Supabase Edge Functions, Zapier, or a cron service — that calls an API Route Handler. Never use `setInterval`, `setTimeout`, or worker threads for scheduled work. |
| Single-process model | Do not assume multiple Node.js processes or shared in-process memory. Soft locks (cart, shifts) must be implemented in the database, not in-process memory. |

### Docker Development Configuration

Docker mirrors production as closely as possible. Use this configuration:

**`Dockerfile`**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static
ENV PORT=3000
ENV NODE_ENV=production
CMD ["node", ".next/standalone/server.js"]
```

**`docker-compose.yml`**
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=production
      - PORT=3000
```

**Docker parity rules:**
- Use `node:20-alpine` to match Hostinger's Node 20 runtime
- Run the built `standalone/server.js` — not `next dev`
- Use `npm ci`, not `npm install`, to match Hostinger's clean install behavior

---

## 3. Badge Maker Integration (Existing Codebase)

The badge-maker repository (`https://github.com/NCharby/badge-maker`) is a production-ready Next.js application that will be absorbed into the SD Platform as the **Badge Module**. The new platform must be architected to accommodate the badge-maker code with minimal modification.

### Existing Capabilities

- Live badge preview with real-time updates
- Multi-event support via dynamic `[event-name]` routing
- Image upload, crop, and optimization
- Social media link integration
- Automated PDF delivery via Postmark
- Telegram integration with automatic invite link generation
- Mobile-responsive design
- Row Level Security and audit trails

> **Note:** The waiver functionality previously in the badge-maker codebase is not absorbed into the SD Platform. Waiver signing is handled by Odoo (see §4 and §6.7).

### Key Constraints

- The Badge Module's existing DB schema (`supabase/schema.sql`) on the `master` branch is the production baseline. It must not be modified.
- New platform tables must be additive — added via `supabase/migrations/` timestamped files, never by altering badge-maker tables.
- The `[event-name]` dynamic routing pattern must be preserved for backward compatibility.

### Existing Table Reference

Full inventory of the 7 badge-maker tables and how the new platform must treat each:

| Table | What it contains | Platform treatment |
|---|---|---|
| `events` | Badge-maker event config: `id`, `slug`, `name`, `description`, `start_date`, `end_date`, `is_active`, `template_id` | **Read-only. Do not add columns.** New platform creates a separate `platform_events` table linked via `slug` |
| `templates` | Badge template configurations (JSONB `config`) | Read-only from platform; the Badge Module manages this directly |
| `sessions` | Anonymous single-use badge-maker sessions with 2-hour expiry | Read-only from platform; not user auth — do not confuse with Supabase Auth sessions |
| `waivers` | Legacy waiver records including personal info and signature data | Read-only / legacy; new waiver data goes to Odoo, not this table |
| `badges` | Badge instances linking session, event, waiver, and image URLs | Read-only from platform; the Badge Module manages this directly |
| `analytics` | Badge-maker usage event log | Read-only from platform |
| `telegram_invites` | Telegram invite links with expiry tracking | Read-only from platform |

**Critical naming conflict — `events` table:**
The badge-maker `events` table is **not** the new platform's Event model. The new platform must use a separate table (e.g., `platform_events`) for its full Event model. When the Badge Module is enabled for an event, `platform_events` links to the badge-maker `events` table via the shared `slug` value. Never add columns to the badge-maker `events` table.

**Storage buckets (badge-maker):**
- `badge-images` — 5MB limit, JPEG/PNG/WebP/GIF
- `waiver-documents` — 10MB limit, PDF only

These buckets and their RLS policies must not be modified. New platform storage needs go in new buckets.

**`platform_events` table schema** (new platform table, created via migration):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE NOT NULL | URL-safe identifier; used for `[event-name]` routing; links to `events.slug` in badge-maker when Badge Module is enabled |
| `owner_id` | UUID FK NOT NULL | References the Event Promoter's platform user record |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `start_date` | DATE NOT NULL | |
| `end_date` | DATE NOT NULL | |
| `location` | TEXT | Physical address; used when Venue module is disabled |
| `venue_id` | UUID FK | References `venues` table; used when Venue module is enabled |
| `status` | TEXT NOT NULL | Current status; one of the 7 system-fixed values or the `name` of a custom intermediate status |
| `workflow_statuses` | JSONB | Ordered array of custom intermediate status objects: `[{ "id": UUID, "name": string, "order": integer, "description": string }]`. `id` is a stable UUID referenced by `module_config` and `cancellation_policy`. `name` can be renamed without breaking references. |
| `module_config` | JSONB | Which modules are enabled, required vs. optional, and which status triggers each to open. `opens_at_status` and `closes_at_status` store the **UUID** from `workflow_statuses` (not the display name) so that renaming a status does not break module triggers. |
| `telegram_group` | TEXT | |
| `discord_server` | TEXT | |
| `social_media_links` | JSONB | |
| `application_open_date` | TIMESTAMPTZ | |
| `tickets_open_date` | TIMESTAMPTZ | |
| `room_lock_in_date` | TIMESTAMPTZ | |
| `room_closed_date` | TIMESTAMPTZ | |
| `group_chat_links` | JSONB | |
| `hotel_contact_email` | TEXT | Per-event hotel contact email override; if null, falls back to `venues.email` |
| `cancellation_policy` | JSONB | `{ checkpoints: [{ status_id: UUID, refund_percentage: integer }] }` — checkpoints reference status UUIDs from `workflow_statuses`, not names |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**RLS policy for `platform_events`** (implemented via Supabase RLS on the migration):

| Operation | System Administrator | Event Promoter | User (Attendee) |
|---|---|---|---|
| SELECT | All rows | Own rows (`owner_id = auth.uid()`) | None |
| INSERT | Yes | Yes (own `owner_id` only) | None |
| UPDATE | All rows | Own rows (`owner_id = auth.uid()`) | None |
| DELETE | All rows | Own rows (`owner_id = auth.uid()`) | None |

Users have no direct access to `platform_events`. Event data is served to attendees exclusively through authenticated API Route Handlers that apply their own authorization checks (e.g., verifying the user is registered for the event before returning event details).

---

## 4. External Services & Integrations

### Required (Core Platform)

| Service | Purpose | Notes |
|---|---|---|
| Supabase | Database, Auth, Storage, RLS | Required — already in use |
| Postmark | Transactional email delivery | Required — already in use |
| Telegram Bot API | Notifications, channel management | Required — already in use |
| Square | Payment processing (primary) | Active when EP's `payment_provider = 'square'`; idempotency key = checkout session ID; webhook event: `payment.completed`; all webhook requests verified via Square signature header before processing |
| PayPal | Payment processing (backup) | Active when EP's `payment_provider = 'paypal'`; webhook event: `PAYMENT.CAPTURE.COMPLETED`; all webhook requests verified via PayPal signature before processing |
| Zapier | Automation / workflow glue | Existing paid subscription; retain regardless |
| Odoo | Waiver signing, Help Desk, CRM, Email Marketing | Replaces badge-maker waiver workflow; **[BLOCKER]** — API details not yet available; see §12 |

> **Square Note:** Square has historically terminated accounts for adult-content-adjacent businesses. PayPal must be integrated in parallel so there is no single point of failure in payment processing. Stripe was previously blocked.

**Payment Provider Architecture:**
- Each Event Promoter configures their own payment provider. The active provider is set per Event Promoter (stored on the EP's platform profile/settings record) and selects which provider is used for all events that EP manages. Valid values: `square`, `paypal`. This allows the platform to serve multiple Event Promoters who each use different processors.
- The platform implements a payment provider interface with operations: `createPayment`, `refundPayment`, `verifyWebhook`. Each provider implements this interface. Adding a new provider requires only a new implementation and a new valid value for `payment_provider`.
- **Provider locking per transaction:** At checkout, the EP's current `payment_provider` is copied and stored on the `orders` record. Refunds always use the provider from the original `orders` record — not the EP's current setting. This ensures refunds work correctly even if the EP changes providers after an event.
- **Idempotency:** Square requires an idempotency key per `createPayment` call. The platform uses the `orders.id` (a UUID generated when the user begins checkout) as the idempotency key.
- **Webhook verification:** Both Square and PayPal sign webhook payloads. All incoming requests to `/api/payments/webhook` must have their signature verified before any processing occurs. Unverified requests are rejected with `401`.

### Planned Integrations

| Service | Purpose | Priority |
|---|---|---|
| Age Verification API | One-time online DOB verification; result stored on user profile — NOT a checkout gate | Post-MVP (provider TBD) |
| Hotel / Venue API | Automated room status polling (if available) | Future |

### Replaced Tools (Deprecated on Launch)

| Tool | Replaced By |
|---|---|
| Ticket Tailor | SD Platform Ticketing Module |
| FreshDesk | Odoo Help Desk |
| ActiveCampaign | Odoo CRM + Email Marketing |
| QuickBooks Online | Odoo Accounting (future) |

---

## 5. Data Models

### Roles

The platform has three distinct roles:

**System Administrator**
- Created by default in the system with known credentials at first deployment
- Full access to platform-level configuration
- Can designate Users as Event Promoters
- Not limited to any single event

**Event Promoter**
- A User who has been designated as an Event Promoter by a System Administrator
- Can create and manage events, configure modules, manage attendees
- Cannot access or modify platform-level configuration
- Operates within the scope of events they manage

**User (Attendee)**
- A registered account on the platform
- Participates in events as an attendee

> **Area Lead is not a platform role.** It is a display label that an Event Promoter may assign to a volunteer's record within an event for organizational clarity (e.g., to identify who coordinates a specific area). It does not grant additional platform permissions. In the data model, it is stored as a label field on the `UserVolunteerSignup` record.

---

### Permissions Matrix

| Data | System Administrator | Event Promoter | User (Attendee) |
|---|---|---|---|
| Platform configuration | Read/Write | None | None |
| All user profiles (all fields) | Read/Write | None (except own events — see below) | Own profile only |
| User profile — attendees of own events | Read/Write | Full read (all fields incl. DOB, phone, address) | None |
| All events on platform | Read/Write | None (other promoters' events) | None |
| Own events | Read/Write | Full Read/Write | None |
| Attendee records — own event (ticket, room, application, volunteer, lock status) | Read/Write | Full read; write via module actions | Own record only |
| Attendee records — other events | Read/Write | None | None |
| Application responses — own event | Read/Write | Full read | Own only |
| Room blocking / reservations | Read/Write | Own events only | None |
| Roommate Finder card data (see below) | Read/Write | Read/Write | Read (event attendees only) |

**Roommate Finder card — fields visible to Users:**
- Room name and number
- Room type / lodging type
- Min/Max occupancy
- Open spot count
- Room Lead scene name (or "Anonymous" if the user has enabled privacy)
- Each bed spot: occupant scene name or "OPEN" status (highlighted yellow); name replaced with "Anonymous" if occupant enabled privacy

**Fields explicitly NOT accessible to Users about other attendees:**
- Email, phone, address, date of birth
- Application responses
- Ticket purchase details or amount paid
- Social media links or any full profile data
- Attendee records from events the User is not attending

> **Note:** No attendee profile browsing exists beyond the Roommate Finder. The Registry feature is explicitly excluded from the platform. Area Lead is not a role and does not appear in this matrix — it is a display label only (see Roles section).

---

### User

A User is a registered account on the platform. Users are uniquely identified by email address.

**Required Fields:**
- `email` — unique identifier
- `password` (hashed)
- `telegram_handle` — stored without the `@` prefix (platform strips it if the user includes it); bot-verified: after account creation, the Telegram bot sends a one-time confirmation code to the provided username; the user enters the code in the platform to verify the handle; account activation is gated on email verification only — Telegram verification is independent and can be completed later from the Profile Management page; unverified handles are flagged and will not receive Telegram notifications until verified; uniqueness is not enforced (two accounts may share a handle, e.g., a couple sharing one Telegram account)
- `date_of_birth` — must be 21+ to register

**Optional Fields:**
- `preferred_scene_name` — the name displayed for this user in all platform contexts (Roommate Finder, attendance slip, EP panel, notifications); if blank, the platform falls back to the portion of the user's email address before the `@`
- `other_scene_name[]` — one or more additional scene names the user goes by; stored for EP reference only; not displayed in any user-facing UI
- `phone`
- `address`
- `zip_code`
- `social_media[]` — key/value pairs
  - Default Keys:
    - Twitter / X
    - Bluesky
    - Discord
    - Instagram
    - Fetlife
    - Recon
    - free text the user can add as key
- `profile_picture`
- `roommate_finder_hidden` (boolean, default: false) — if true, the user's name is displayed as "Anonymous" in all Roommate Finder views across all events; manageable from the Profile Management page

**Account Creation Flow:** User submits required fields → email verification required → account active on confirmation.

**Age Restriction:** Users under 21 are denied account creation.

---

### Event

An Event is created by an Event Promoter and is a collection of configured modules.

**Required Fields:**
- `title`
- `description`
- `start_date`
- `end_date`
- `location` (physical address if Venue module disabled; Venue object if enabled)

**Optional Fields:**
- `telegram_group`
- `discord_server`
- `social_media_links[]`
- `application_open_date`
- `tickets_open_date`
- `room_lock_in_date`
- `room_closed_date`
- `group_chat_links`

**Required Module:** Ticketing is the only module required to create an Event. All other modules are optional and enabled by the Event Promoter during Event configuration.

**Module Configuration:** As part of Event creation, the Event Promoter configures each enabled module with:
- **Enabled / disabled** — whether the module is active for this event
- **Required vs. optional** — whether attendees must complete the module to reach "Ready to Lock"
- **`opens_at_status`** — the workflow status at which the module becomes active for eligible attendees; when the event transitions to this status, the module opens automatically (EP may also open/close manually at any time)
- **`closes_at_status`** — the workflow status at which the module becomes read-only; `null` means the module remains open until `Event Locked`

**Attendee eligibility:** When a module opens (event reaches `opens_at_status`), it is accessible only to attendees who have completed all required modules from statuses that appear earlier in the workflow order. For example, if Application (required) opens at "Applications Open" and Ticketing opens at "Tickets Open" (a later status), only attendees with an Approved application can access Ticketing when "Tickets Open" is reached.

**Module completion definitions** (used to determine eligibility for later-status modules):

| Module | Completion Condition |
|---|---|
| `application` | `application_status = 'Approved'` (requires EP action) |
| `ticketing` | `ticket_status = 'Complete'` (ticket purchased) |
| `waiver` | Waiver record marked as EP-verified in platform |
| `room_selection` | `room_status = 'Locked In'` or better |
| `volunteering` | Confirmed signed-up hours ≥ `ticket.volunteer_hours_required`; auto-complete if ticket has no hours requirement |
| `schedule` | No completion state — informational only; never gates other modules |
| `badge` | Badge record exists for user + event; never gates other modules |

**`module_config` JSONB structure** (stored on `platform_events.module_config`):

> **Important:** `opens_at_status` and `closes_at_status` store the **UUID** of the corresponding entry in `workflow_statuses` — not the display name. This ensures renaming a status does not silently break module triggers. For system-fixed statuses (`Published`, `Event Locked`, etc.), use the string name directly since they have no UUID.

```json
{
  "application": {
    "enabled": true,
    "required": true,
    "opens_at_status": "550e8400-e29b-41d4-a716-446655440000",
    "closes_at_status": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  },
  "ticketing": {
    "enabled": true,
    "required": true,
    "opens_at_status": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "closes_at_status": null
  },
  "waiver": {
    "enabled": true,
    "required": true,
    "opens_at_status": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "closes_at_status": null
  },
  "room_selection": {
    "enabled": true,
    "required": false,
    "opens_at_status": "a97b5c3e-12f4-4d87-a8c9-5e67f210d3b1",
    "closes_at_status": null
  },
  "volunteering": {
    "enabled": true,
    "required": false,
    "opens_at_status": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "closes_at_status": null
  },
  "schedule": {
    "enabled": true,
    "required": false,
    "opens_at_status": "Published",
    "closes_at_status": null
  },
  "badge": {
    "enabled": true,
    "required": false,
    "opens_at_status": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "closes_at_status": null
  }
}
```
Keys absent from the object = module disabled for this event. `closes_at_status: null` = module remains open until `Event Locked`.

**Status renaming protection:** When an EP renames a custom workflow status, the system checks whether any `module_config` `opens_at_status`/`closes_at_status` or any `cancellation_policy` checkpoint references the status UUID. If yes, the EP is warned: "Renaming will update the display name only — all module triggers and policy checkpoints remain intact via their UUID references." No UUID references are changed on rename.

**Event Statuses:**

*Tier 1 — System-Fixed (7 statuses; always present, cannot be renamed or removed):*
- `Draft` — event is being configured; not visible to users
- `Published` — event is visible and marketing can begin; no modules are open yet
- `Event Locked` — attendance, rooms, and all associated details are frozen; no further user changes
- `Registration` — on-site check-in phase
- `Happening Now` — event is actively occurring
- `Closed` — event has ended
- `Archived` — event is a read-only historical record

*Tier 2 — Custom Intermediate Statuses (Event Promoter-defined):*
- The Event Promoter may add any number of free-form, custom-named statuses between `Published` and `Event Locked`
- Names are entirely up to the Event Promoter (e.g., "Applications Open", "Rooms Open", "BUY YOUR TICKET")
- These statuses define the progression visible to users and event promoters as the event moves toward lock

*Module Access Triggers:*
- When configuring the event, the Event Promoter designates a specific status (fixed or custom) as the trigger for each enabled module
- When the event transitions to that status, the module opens automatically for users
- The Event Promoter may manually override module access at any time, independent of current status

**Configurable Modules:**
- Ticketing *(required)*
- Venue
- Application
- Waiver (via Odoo)
- Volunteering
- Schedule
- Badge

---

### User ↔ Event Relationship (Attendee Record)

Each User who participates in an Event has an attendee record with per-module statuses:

**Application Status:**
`Incomplete → In Progress → Needs Review → Completed → Approved → Declined → Closed`

**Waiver Status:**
`Incomplete → Completed → Declined`

**Ticket Status:**
`Incomplete → Complete`

**Room Status:**
`Not Selected → Selected → Locked In → Verified → Critical Issue`

**Attendee Lock Status:**
`Unlocked → Ready to Lock → Locked`

> **Lock-In Clarification:** Once a User has completed all required modules for an Event, they may declare "Ready to Lock." This notifies the Event Promoter, who can then manually Lock that user. A Locked user cannot make any further changes to their details related to that Event. "Event Locked" is a separate platform-level status signaling that no further changes should be made to who is attending, what room they are in, or any associated event details.

> **Note:** Room status behavior differs between Room Lead and Roommate. See §6.3 for role definitions.

---

### Venue

A Venue is the reference for all rooms and pricing available for an Event. Required by the Room Selection module.

**Venue Fields:**
- `name` (required)
- `physical_address` (required)
- `website` (optional)
- `email` (optional)
- `phone` (optional)

**Room Matrix:** A Venue contains a Room Matrix — the complete set of available rooms. The Room Matrix can be created manually or uploaded via CSV.

---

### Room

**Fields:**
- `name` — e.g., "King Studio", "Queen Double"
- `number` — alphanumeric room identifier (e.g., "101", "A2", "King-3"); accepts any combination of letters and numbers; if not provided by the Event Promoter, the system assigns `AUTO-{n}` where `n` is a sequential integer scoped to the venue's room matrix (e.g., `AUTO-1`, `AUTO-2`); the system-assigned value is stored in the same `number` column and is used wherever a room number appears (attendance slip, Roommate Finder, hotel report)
- `description`
- `bed_spot_count` — number of individual reservable person slots in the room (equals max occupancy)
- `min_occupancy` — minimum number of people expected to occupy the room; displayed in the Roommate Finder card alongside max occupancy; informational only
- `room_code` — free-text code provided by the EP or hotel; used at venue check-in for confirmation; the platform does not generate room codes; null if not provided
- `lodging_type`
- `room_daily_rates` — JSONB column storing an array of `{ "date": "YYYY-MM-DD", "amount": 233.20 }` objects, one entry per **check-in night** of the event (excludes checkout day); rates may differ per night; platform displays each night's rate and a calculated total; no payment is processed by the platform (informational only). Example: for a Thu–Sun event, entries are for Thursday, Friday, and Saturday — Sunday (checkout day) has no rate entry.
- `bed_type`
- `has_kitchen` (boolean)
- `location_zone`
- `room_group` — optional grouping for event promoter blocking and ticket type assignment

**Room Blocking:** Event Promoters can block rooms or individual beds at any time. Blocked rooms/beds are hidden from the Room Selection interface and Roommate Finder. Notes may be added to blocked rooms (e.g., "Staff", "Playroom", "Hotel Maintenance"). Blocks are logged with an audit trail.

**Room Reservations (Event Promoter):** The Event Promoter has a dedicated view of the Roommate Finder that allows them to Reserve entire Rooms, Room Groups, or individual bed spots. A note may be attached to the reservation, which can optionally be displayed to Users. Reserved rooms, groups, or bed spots are not available for selection by Users.

**Room Matrix CSV Import Format**

When uploading a Room Matrix via CSV, the file must conform to the following column specification. Column headers are case-insensitive. Column order does not matter. Reference template: `SD Platform Room Matrix Template.csv`.

**Required columns:**

| Column Header | Maps To | Notes |
|---|---|---|
| `Room Number` | `number` | Alphanumeric; if blank, system assigns `AUTO-{n}` scoped to the venue (not an error) |
| `Room Name` | `name` | Room type label (e.g., "Hill King Studio", "2 Queen Suite") |
| `Max Occupancy` | `bed_spot_count` | Positive integer; number of individual reservable person slots |
| `Min Occupancy` | `min_occupancy` | Positive integer ≤ Max Occupancy |

**Pricing columns (day-of-week):** Include a column for each check-in night of the event. At import time, the system maps day-of-week names to actual event dates using the event's start and end dates. Only check-in nights are imported — the checkout day column is ignored. Example: for a Thu–Sun event, Thursday, Friday, and Saturday columns are imported; the Sunday column is ignored.

| Column Header | Notes |
|---|---|
| `Sunday` | Dollar amount; e.g., `$233.20` or `$ 233.20` — whitespace and `$` stripped on import |
| `Monday` | Same format |
| `Tuesday` | Same format |
| `Wednesday` | Same format |
| `Thursday` | Same format |
| `Friday` | Same format |
| `Saturday` | Same format |

**Optional columns** (blank cells imported as null):

| Column Header | Maps To | Notes |
|---|---|---|
| `Room Description` | `description` | Free-text notes about the room |
| `Room Code` | `room_code` | Alphanumeric code used at venue check-in |
| `Bed Type` | `bed_type` | e.g., King, Queen, Double Queen, Bunk, RV |
| `Lodging Type` | `lodging_type` | e.g., Studio, Suite, Kitchenette, Camper |
| `Has Kitchen` | `has_kitchen` | Accepts: `TRUE`, `FALSE`, `Y`, `N`, `Yes`, `No`, `1`, `0` (case-insensitive); blank = false |
| `Location Zone` | `location_zone` | e.g., Hill, Garden, Courtyard, Street Level |
| `Room Group` | `room_group` | Group name for EP blocking and ticket type assignment |

> **Previous template column mapping:** The prior template used `Description` (→ `Room Name`), `Max Total Attendees in Room` (→ `Max Occupancy`), and `Min Total Attendees in Room` (→ `Min Occupancy`). These old headers are not recognized by the importer — files must use the updated column names.

**Import error handling:**

| Condition | Behavior |
|---|---|
| Missing required column (`Room Name`, `Max Occupancy`, `Min Occupancy`) | Reject entire import; report missing column name |
| `Room Name` blank on any row | Reject that row; report row number |
| Dollar amount that cannot be parsed | Reject that row; report row number and column |
| `Min Occupancy > Max Occupancy` on any row | Reject that row; report row number |
| Duplicate `Room Number` within the same import | Reject duplicates; retain first occurrence; report duplicate row numbers |
| Unrecognized column headers | Warn in import summary; do not reject (forward-compatible) |

---

### Ticket

**Ticket Group:**
- `name`
- `available_count` (overrides individual ticket counts if set — enables shared pool)
- `price`

**Ticket:**
- `name`
- `available_count`
- `price`
- `room_lead` — designates the attendee as `Room Lead` (available if Room Selection module is enabled)
- `volunteer_hours_required` (optional — inserts volunteer shift selection into checkout flow)
- `room_type_assignment[]` (optional — restricts room selection to specified room types/groups)
- `room_required_at_purchase` (boolean) — if true, room selection is part of the ticket checkout flow and the room is automatically locked upon purchase completion

---

### VolunteerShift

A VolunteerShift represents a single volunteer opportunity within an Event. Shifts may be created directly or generated from a Schedule activity via the Schedule → Volunteer integration.

**VolunteerShift Fields:**
- `id`
- `event_id`
- `schedule_activity_id` (optional — links to a Schedule activity when created via module integration)
- `name` — shift name/description
- `date_time` — shift start date and time
- `duration` — length of the shift; this duration counts toward a user's `volunteer_hours_required`
- `capacity` — maximum number of volunteers for this shift
- `signed_up_count` — current confirmed signup count

**UserVolunteerSignup Fields:**
- `user_id`
- `shift_id`
- `event_id`
- `status` — `pending_checkout | confirmed | no_show`
- `completed` (boolean) — set manually by Event Promoter after the event; record-keeping only, does not gate any workflow
- `area_lead_label` (boolean, default false) — display label assigned by Event Promoter for organizational purposes; does not affect permissions

**Soft-lock during checkout:** When a user selects a shift during ticket checkout, a soft-lock is applied to that shift spot for **15 minutes** (same mechanism as ticket soft-lock). The lock is released if checkout is abandoned or the 15-minute window expires. On purchase completion, the signup status transitions to `confirmed`.

**Hours countdown:** The user's portal and shift selection page display: confirmed signed-up hours ÷ `ticket.volunteer_hours_required`. Example: "3 of 4 required hours selected." Based on confirmed signups, not post-event completion marks.

**Constraints:** A user may not sign up for the same shift twice, and may not hold two overlapping shifts simultaneously.

---

### Cancellation Policy

The Cancellation Policy is configured by the Event Promoter in the Event Configuration. The Event Promoter selects Event workflow statuses as checkpoints and assigns a refund percentage to each.

**Schema:** Stored as JSONB on `platform_events.cancellation_policy`:
```json
{
  "checkpoints": [
    { "status_id": "550e8400-e29b-41d4-a716-446655440000", "refund_percentage": 100 },
    { "status_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "refund_percentage": 50 },
    { "status_id": "a97b5c3e-12f4-4d87-a8c9-5e67f210d3b1", "refund_percentage": 0 }
  ]
}
```
- `status_id` references the UUID of a `workflow_statuses` entry (not the name) — renaming a status does not break the policy
- `refund_percentage` is an integer 0–100
- At the time of cancellation, the system identifies the most recently passed checkpoint — the highest-order workflow status the Event has already reached — and applies its `refund_percentage`
- The policy applies to all cancellations regardless of timing (there is no automatic full-refund period)
- **Scope:** Applies to ticket price and merchandise sales only. Room costs are excluded — rooms are purchased directly from the hotel and are not processed by the platform.

> **Note:** The specific checkpoints and percentages are defined per Event by the Event Promoter.

---

### Locks

Soft locks prevent race conditions during checkout. All locks are stored in the database — never in-process memory (see §12 for Hostinger constraint rationale).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `resource_type` | TEXT NOT NULL | One of: `ticket`, `shift`, `room`, `merchandise` |
| `resource_id` | UUID NOT NULL | References the locked resource's row |
| `locked_by` | UUID NOT NULL | Platform user ID of the user holding the lock |
| `expires_at` | TIMESTAMPTZ NOT NULL | 15 minutes from creation |
| `created_at` | TIMESTAMPTZ | |

A lock is acquired at the start of checkout and released on purchase completion, abandonment, or expiry. Expired locks must be checked and cleared before a new lock on the same resource is allowed.

---

### Room Open Group

Room Open Group is an optional Event Promoter tool for incrementally opening room access to specific attendees before the general room open. It is distinct from **Room Group**, which is a static organizational grouping of rooms used for blocking and ticket type assignment.

**How it works:**
- The Event Promoter defines an ordered list of named phases for the event (e.g., "VIP", "Early Access", "General Release"), each with a numeric order (lower number = earlier/higher priority)
- The EP may assign a phase to individual rooms (per event) — this phase determines when those rooms become visible
- The EP may assign a phase to individual attendee records — this is their "Room Open Group"
- The EP manually opens phases as the event progresses

**Visibility rule (cumulative):** When the EP opens phase N, all rooms assigned to phase N become visible to attendees whose phase order is ≤ N. Previously opened rooms remain visible as later phases open.

**Default behavior:** If Room Open Group is not configured for an event, all available rooms are visible to all attendees when rooms open normally. Rooms without a phase assignment are always visible to all attendees regardless of group configuration.

**Data homes:**
- Phase definitions (ordered list per event): stored in `platform_events.module_config` JSONB
- Room phase assignment (per event, per room): `event_room_config` join table — `event_id`, `room_id`, `open_group_phase TEXT`
- Attendee phase assignment: `room_open_group TEXT` field on the attendee record (the `UserEvent` relationship table)

---

### Roommate Finder Query Specification

The Roommate Finder view is the primary UI of the Room Selection module — both Room Leads and Roommates use this view when browsing and selecting rooms. The query below drives the card grid for all attendees.

The Roommate Finder presents a derived, privacy-filtered view — not a raw table read. Claude Code must build the query from this specification.

**Source tables:**

| Table | Role |
|---|---|
| `rooms` | Room attributes (number, name, lodging_type, bed_spot_count, min_occupancy, has_kitchen, location_zone, room_group) |
| `event_room_config` | Per-event room state: blocked flag, reserved flag, reservation note, reserved_note_public flag, open_group_phase |
| `event_attendees` | Attendee ↔ room assignment: room_id FK, room_status (`Selected`, `Locked In`, `Verified`), is_room_lead flag |
| `platform_users` | Display name and privacy: preferred_scene_name, roommate_finder_hidden |

**Exclusion filters (applied before any projection):**
- Exclude rooms where `event_room_config.blocked = true`
- Exclude rooms where `event_room_config.reserved = true`
- Exclude rooms not linked to the event's venue

**Room Open Group filter (if configured):**
- If Room Open Group is active for the event, exclude rooms whose `open_group_phase` order is greater than the currently opened phase for the requesting attendee's assigned group

**Projected columns per card:**

| Column | Source | Notes |
|---|---|---|
| `room_id` | `rooms.id` | |
| `room_number` | `rooms.number` | |
| `room_name` | `rooms.name` | |
| `lodging_type` | `rooms.lodging_type` | |
| `min_occupancy` | `rooms.min_occupancy` | |
| `max_occupancy` | `rooms.bed_spot_count` | |
| `open_spot_count` | Derived | `bed_spot_count` minus count of `event_attendees` rows for this room where `room_status` IN (`Selected`, `Locked In`, `Verified`) |
| `room_lead_display_name` | Derived | If no Room Lead: `"OPEN"`. If Room Lead exists and `roommate_finder_hidden = true`: `"Anonymous"`. Otherwise: `preferred_scene_name` (fallback: email-before-@) |
| `occupants` | Derived array | One entry per confirmed occupant. Each entry: `{ display_name: string }` where display_name = `"Anonymous"` if `roommate_finder_hidden = true`, else `preferred_scene_name` (fallback: email-before-@). Open spots appear as `{ display_name: "OPEN" }` until `bed_spot_count` is reached |

**Implementation:** Supabase RPC `get_roommate_finder_cards(event_id UUID)` — a parameterized server-side function. The function enforces that the caller is a confirmed attendee of the event (Block E from §2 RLS patterns) before returning any rows. Returns an array of card objects matching the projected columns above.

**Event Promoter variant:** A separate RPC or query flag (`get_roommate_finder_cards(event_id, include_blocked_reserved: true)`) returns all rooms including blocked and reserved rooms. For reserved rooms, the response includes `reservation_note` (always) and `reservation_note_public` flag. Blocked rooms are annotated with `blocked: true` and `block_note`. The EP variant does not enforce the Block E attendee check — it enforces Block D (EP owns the event).

**User-facing Permissions Matrix note:** "Roommate Finder card data (see below)" in the Permissions Matrix refers exclusively to the projected columns above. It does not include: email, phone, address, DOB, social media links, application responses, ticket details, or any full profile data.

**Roommate Finder filtering:** The card grid supports four client-side filter/search controls applied to the result set from `get_roommate_finder_cards()`:
1. **Open spots only** — toggle; hides rooms with `open_spot_count = 0`
2. **Room/lodging type** — dropdown; filters by `lodging_type` and/or `bed_type`
3. **Location zone** — dropdown; filters by `location_zone`
4. **Search** — text input; case-insensitive match on room name or room number

Client-side filtering is acceptable given expected event sizes (< 100 rooms).

---

## 5a. Complete Database Schemas (Platform Tables)

All new platform tables are created via timestamped migration files in `supabase/migrations/`. The required migration order is:

```
00000000000000_baseline.sql              — badge-maker schema.sql wrapped as baseline
20260101000000_create_platform_users.sql
20260101000001_create_venues.sql
20260101000002_create_rooms.sql
20260101000003_create_platform_events.sql
20260101000004_create_event_attendees.sql
20260101000005_create_ticket_types_and_groups.sql
20260101000006_create_orders.sql
20260101000007_create_merchandise.sql
20260101000008_create_event_room_config.sql
20260101000009_create_bed_blocks.sql
20260101000010_create_locks.sql
20260101000011_create_application_forms.sql
20260101000012_create_schedule_activities.sql
20260101000013_create_volunteer_shifts.sql
20260101000014_create_roommate_applications.sql
20260101000015_rls_policies.sql
20260101000016_functions_and_triggers.sql
```

### `platform_users` (full schema)

All user profile data lives on a single table. No separate profile table.

```sql
CREATE TABLE platform_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'event_promoter', 'system_admin')) DEFAULT 'user',
  email TEXT UNIQUE NOT NULL,           -- mirrored from auth.users for query convenience
  telegram_handle TEXT,                  -- stored without '@'; stripped on input
  telegram_verified BOOLEAN DEFAULT false,
  date_of_birth DATE NOT NULL,
  age_verification_status TEXT CHECK (age_verification_status IN ('unverified', 'pending', 'verified', 'failed')) DEFAULT 'unverified',
  age_verified_at TIMESTAMPTZ,
  age_verification_provider TEXT,        -- 'stub' until real provider selected
  preferred_scene_name TEXT,             -- universal display name; fallback: email-before-@ if null/empty
  other_scene_names TEXT[],              -- EP reference only; never shown in user-facing UI
  phone TEXT,
  address TEXT,
  zip_code TEXT,
  social_media JSONB,                    -- [{ "key": string, "value": string }]
  profile_picture_url TEXT,
  roommate_finder_hidden BOOLEAN DEFAULT false,
  -- Notification preferences
  email_notifications_enabled BOOLEAN DEFAULT true,
  telegram_notifications_enabled BOOLEAN DEFAULT false,  -- set to true when telegram_verified transitions to true
  notification_preferences JSONB,        -- EP only: { "application_submitted": { "in_platform": true, "email": false, "telegram": false }, ... }
  -- EP only
  payment_provider TEXT CHECK (payment_provider IN ('square', 'paypal')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`preferred_scene_name` fallback:** Applies universally — in Roommate Finder, attendance slip, EP panel, notifications, and all platform UI. If `preferred_scene_name` is null or empty string, display the portion of the user's `email` before the `@`.

**`telegram_notifications_enabled` default:** `false` on signup. Set to `true` automatically when `telegram_verified` transitions to `true` (via trigger or Server Action side-effect).

**One ticket per user per event:** A user may hold at most one ticket per event. The `event_attendees` UNIQUE constraint on `(event_id, user_id)` enforces this. Purchasing a second ticket for the same event is blocked with an error.

---

### `venues` (full schema)

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES platform_users(id),  -- EP who created it
  name TEXT NOT NULL,
  physical_address TEXT NOT NULL,
  website TEXT,
  email TEXT,      -- default hotel contact email for weekly reports
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### `rooms` (full schema)

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id),
  number TEXT,            -- null triggers AUTO-{n} trigger on insert
  name TEXT NOT NULL,
  description TEXT,
  bed_spot_count INTEGER NOT NULL,   -- max occupancy; number of reservable slots
  min_occupancy INTEGER NOT NULL,
  room_code TEXT,         -- free text; hotel-provided or EP-defined; null OK; not generated by platform
  lodging_type TEXT,
  bed_type TEXT,
  has_kitchen BOOLEAN DEFAULT false,
  location_zone TEXT,
  room_group TEXT,
  room_daily_rates JSONB, -- [{ "date": "YYYY-MM-DD", "amount": 233.20 }] — check-in nights only, excludes checkout day
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**AUTO-{n} assignment:** A Postgres trigger fires on INSERT when `number IS NULL`. It selects `MAX(n) + 1` from all existing auto-assigned rows (matching `number ~ '^AUTO-\d+$'`) scoped to the same venue, defaulting to `AUTO-1` if none exist. The value is stored in the `number` column and used everywhere room numbers appear.

**Nightly rates:** For an event running Thursday through Sunday, rates are stored for Thursday, Friday, and Saturday (3 check-in nights). The Sunday column from a CSV import is ignored for a Thu–Sun event — checkout day carries no rate.

---

### `event_attendees` (full schema)

```sql
CREATE TABLE event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  user_id UUID NOT NULL REFERENCES platform_users(id),

  ticket_type_id UUID REFERENCES ticket_types(id),
  ticket_purchased_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id),

  application_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (application_status IN ('Incomplete','In Progress','Needs Review','Completed','Approved','Declined','Closed')),
  waiver_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (waiver_status IN ('Incomplete','Completed','Declined')),
  ticket_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (ticket_status IN ('Incomplete','Complete')),
  room_status TEXT NOT NULL DEFAULT 'Not Selected'
    CHECK (room_status IN ('Not Selected','Selected','Locked In','Verified','Critical Issue')),
  lock_status TEXT NOT NULL DEFAULT 'Unlocked'
    CHECK (lock_status IN ('Unlocked','Ready to Lock','Locked')),

  age_verification_status TEXT DEFAULT 'unverified',  -- EP-visible mirror

  room_id UUID REFERENCES rooms(id),
  is_room_lead BOOLEAN NOT NULL DEFAULT false,  -- set from ticket_types.room_lead at purchase; EP-overridable
  room_open_group TEXT,

  volunteer_hours_required INTEGER NOT NULL DEFAULT 0,  -- copied from ticket_types at purchase

  -- MVP 2 only — do not implement logic in MVP 1
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(event_id, user_id)
);
```

---

### `ticket_types` and `ticket_groups`

```sql
CREATE TABLE ticket_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  name TEXT NOT NULL,
  available_count INTEGER,   -- shared pool; null = use individual ticket_types counts
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  ticket_group_id UUID REFERENCES ticket_groups(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_count INTEGER,   -- null = unlimited
  room_lead BOOLEAN NOT NULL DEFAULT false,
  volunteer_hours_required INTEGER NOT NULL DEFAULT 0,
  room_required_at_purchase BOOLEAN NOT NULL DEFAULT false,
  room_type_restriction TEXT[],  -- room_group names; empty = no restriction
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### `orders` and `order_items`

The `orders.id` UUID is generated at checkout start and serves as the Square idempotency key.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  user_id UUID NOT NULL REFERENCES platform_users(id),
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('square','paypal')),  -- locked at transaction time
  payment_transaction_id TEXT,   -- set on completion
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','complete','refunded','partial_refund','cancelled')),
  subtotal DECIMAL(10,2) NOT NULL,
  amount_refunded DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('ticket','merchandise')),
  item_id UUID NOT NULL,   -- FK to ticket_types or merchandise
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount_refunded DECIMAL(10,2) DEFAULT 0
);
```

---

### `merchandise`

```sql
CREATE TABLE merchandise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_count INTEGER,   -- null = unlimited; finite counts use the Locks table
  image_url TEXT,
  ticket_type_restriction UUID[],  -- empty = no restriction; else array of ticket_type IDs
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Restriction:** When `ticket_type_restriction` is non-empty, only show this merchandise item to users whose ticket type ID is in the array.

**Soft lock:** Merchandise with finite `available_count` uses the same 15-minute Locks mechanism as tickets, with `resource_type = 'merchandise'`.

---

### `event_room_config`

Per-event overlay on top of the venue's room matrix.

```sql
CREATE TABLE event_room_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  blocked BOOLEAN NOT NULL DEFAULT false,
  block_note TEXT,                   -- EP-visible only
  reserved BOOLEAN NOT NULL DEFAULT false,
  reservation_note TEXT,
  reservation_note_public BOOLEAN NOT NULL DEFAULT false,  -- if true, shown to users
  open_group_phase TEXT,             -- Room Open Group phase name; null = visible to all
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES platform_users(id),
  UNIQUE(event_id, room_id)
);
```

---

### `bed_blocks`

Per-bed blocking (reduces effective capacity without removing the room).

```sql
CREATE TABLE bed_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  bed_number INTEGER NOT NULL,  -- positional slot 1..bed_spot_count
  block_note TEXT,              -- EP-visible only
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES platform_users(id),
  UNIQUE(event_id, room_id, bed_number)
);
```

**Effect on Roommate Finder:** Effective max occupancy = `bed_spot_count − COUNT(bed_blocks)` for that room+event. `open_spot_count` uses the effective max, not the raw `bed_spot_count`.

---

### `application_forms` and `application_responses`

**Copy-on-assign:** When an EP configures an event's Application module, they may select a previously created form from their event history. The system copies the form to the new event (`source_form_id` tracks lineage). Changes to the copy do not affect the original.

```sql
CREATE TABLE application_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE REFERENCES platform_events(id),  -- one form per event
  source_form_id UUID REFERENCES application_forms(id), -- null if original
  title TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  -- fields: [{ "id": UUID, "type": "text"|"radio"|"checkbox"|"key_value", "label": string, "options": string[], "required": boolean, "order": integer }]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE application_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  user_id UUID NOT NULL REFERENCES platform_users(id),
  form_id UUID NOT NULL REFERENCES application_forms(id),
  responses JSONB NOT NULL DEFAULT '{}',
  -- responses: { "field_uuid": answer_value }
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

---

### `schedule_activities`

```sql
CREATE TABLE schedule_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  name TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT NOT NULL,
  volunteers_requested BOOLEAN NOT NULL DEFAULT false,
  volunteer_count INTEGER,
  volunteer_shift_duration_minutes INTEGER,
  volunteer_shift_date_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### `volunteer_shifts` and `user_volunteer_signups`

```sql
CREATE TABLE volunteer_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  schedule_activity_id UUID,   -- FK to schedule_activities if created via integration
  name TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_volunteer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  user_id UUID NOT NULL REFERENCES platform_users(id),
  shift_id UUID NOT NULL REFERENCES volunteer_shifts(id),
  status TEXT NOT NULL DEFAULT 'pending_checkout'
    CHECK (status IN ('pending_checkout','confirmed','no_show')),
  completed BOOLEAN DEFAULT false,
  area_lead_label BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, shift_id)
);
```

---

### `roommate_applications`

Tracks both the Roommate apply flow (initiated by Roommate) and the Room Lead claim-by-email flow (initiated by Room Lead).

```sql
CREATE TABLE roommate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  applicant_user_id UUID NOT NULL REFERENCES platform_users(id),  -- person applying or being claimed
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('roommate','room_lead')),
  bed_number INTEGER,       -- specific bed targeted; null = any open spot
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','cancelled','superseded')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES platform_users(id)
);
```

**Conflict resolution:** When Room Lead accepts any application or claim for a specific bed spot, all other pending applications/claims for that same spot are automatically set to `'superseded'`. Those users receive the standard decline notification (row 9).

---

### `locks` (full schema)

```sql
CREATE TABLE locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('ticket','shift','room','merchandise')),
  resource_id UUID NOT NULL,
  locked_by UUID NOT NULL REFERENCES platform_users(id),
  expires_at TIMESTAMPTZ NOT NULL,   -- 15 minutes from creation
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Module Specifications

### 6.1 Application Module

The Application Module replicates the existing Google Form-based application process with improved automation and event promoter tooling.

**Event Promoter Capabilities:**
- Create custom application forms with the following field types: `text`, `radio`, `checkbox`, `key_value`
- **Copy-on-assign:** When configuring an event, the EP may select a previously created form from their event history; the system copies it to the new event (`source_form_id` tracks lineage); changes to the copy do not affect the original
- Associate an application form to an Event to enable the module
- Review submitted applications and update application status
- Receive notifications when users submit or update applications
- **Reverted approval UI:** When changing an attendee's `application_status` from `Approved` back to `Declined` or `Needs Review`, if the attendee has a completed ticket purchase, the platform displays a modal with two explicit options:
  - "Cancel ticket and initiate refund (per Cancellation Policy)" — calls the refund API; marks ticket cancelled
  - "Block portal access only (preserve ticket)" — changes status; user loses access to later-gated modules; ticket preserved; EP note required
  - No automatic action occurs without EP selection

**User Capabilities:**
- Complete, update, or withdraw an application (withdrawal blocked after Attendance Lock)
- Re-submit triggers event promoter notification
- Form pre-populated with previous responses on revisit
- Client and server-side validation before submission

---

### 6.2 Ticketing Module

Ticketing is the only module required for Event creation. All other modules are optional.

**Checkout Flow:**
1. User selects ticket type
2. If `room_required_at_purchase` is enabled: room selection is inserted into the checkout flow; room is auto-locked on purchase completion
3. If ticket type requires volunteer hours: volunteer shift selection is inserted; selected shifts are soft-locked for **15 minutes** (same mechanism as ticket soft-lock); lock releases if checkout is abandoned or the 15-minute window expires; on purchase completion, signups are confirmed
4. User selects merchandise (if applicable)
5. Cart is passed to Square (primary) or PayPal (backup) via API
6. Purchase confirmation opens other event modules

**Soft Lock on Cart:** A soft lock must be applied to tickets, merchandise, and volunteer shifts during checkout to prevent race conditions and overselling. All locks use the `locks` table with `resource_type` = `ticket`, `merchandise`, or `shift`.

**Single ticket per user per event:** A user may purchase at most one ticket per event. Attempting to purchase a second is blocked with an error.

**Refund Policy:**
- The configured Cancellation Policy always applies at the time of cancellation — there is no automatic full-refund period
- **Pre-lock:** Users may self-initiate a cancellation via the platform. The platform calculates the applicable refund percentage per the Cancellation Policy, calls the Square or PayPal Refund API using the provider stored on the **original `orders` record** (not the EP's current setting), and records the result. The ticket is marked cancelled.
- **Post-lock:** Refunds require Event Promoter initiation only. The EP initiates the refund from the event management panel; the platform calls the Refund API for the provider on the original order. No user-initiated refunds are permitted post-lock.
- Refunds apply to ticket and merchandise purchases only; room costs are not handled by the platform

**Merchandise in checkout (step 4):**
- Merchandise items shown are filtered by `ticket_type_restriction`: if non-empty, only show items whose restriction includes the user's ticket type ID
- Merchandise with finite `available_count` uses the 15-minute Locks mechanism (`resource_type = 'merchandise'`)
- Items display: name, description, image (if set), price, and remaining availability

**Age Verification:**

All attendees (first-time and returning) receive **in-person ID verification at check-in**. This is handled by a separate on-site registration application — not by the SD Platform.

The platform supports an optional **one-time online age verification** per user profile. Once verified, the result is stored on `platform_users.age_verification_status`. This is NOT a checkout gate — users are never blocked from purchasing tickets based on online verification status.

**Age Verification Hook Contract:**

```typescript
// lib/age-verification/types.ts
type AgeVerificationStatus = 'verified' | 'pending' | 'failed';

interface AgeVerificationResult {
  status: AgeVerificationStatus;
  verifiedAt?: Date;
  provider: string; // 'stub' until real provider is integrated
}

// lib/age-verification/index.ts
// Called once per user from their profile context — not from checkout
export async function verifyAge(
  userId: string,
  dateOfBirth: Date
): Promise<AgeVerificationResult>
```

**Stub implementation** (until provider is selected):
```typescript
// TODO: Age verification — stub only; replace when provider is selected
return { status: 'verified', provider: 'stub' };
```

**Downstream handling** (stored on user profile; no checkout impact):
- `verified` → store on `platform_users.age_verification_status = 'verified'`; visible to EP
- `pending` → store on profile; EP can see flag; user proceeds normally
- `failed` → store on profile; EP is notified; manual resolution at check-in

---

### 6.3 Room Selection Module

**Prerequisites:**
- Event must have an associated Venue
- Venue must have an associated Room Matrix
- Room Selection module must be enabled by the Event Promoter

**Activation:** Event Promoter transitions Event status to "Rooms Open."

**Room Open Group (optional):** The Event Promoter may configure named access phases for the event. When configured, the EP assigns a phase to rooms (per event) and to attendee records. The EP opens phases manually to release rooms to the matching attendee group and all earlier-priority groups (cumulative). Attendees without a phase assignment can only see unphased rooms. If Room Open Group is not configured, all attendees see all available rooms when rooms open. See the Room Open Group data model in §5 for full specification.

**Role Assignment:** A User's role (Room Lead or Roommate) is determined by the Ticket Type they purchase.

**Room Payment Note:** The platform does not process room payments. Rooms are purchased directly from the hotel. The platform manages room selection, confirmation, and lock status only. Room pricing data is informational.

**Hotel Map Image:** The Event Promoter may upload a static image of the hotel floor plan or property map for a given event. This image is displayed as a reference alongside the room selection grid — it is purely informational and has no interactive elements. The EP uploads the image via the event configuration panel; it is stored in Supabase Storage. No SVG, embedded map, or third-party floor plan library is used.

**Room Selection UI:** The primary interface of the Room Selection module is a clean grid layout displaying room cards (referred to throughout this document as the "room selection grid" or "Roommate Finder view"). All attendees — Room Leads and Roommates alike — use this same view when browsing and selecting rooms. Each card displays:
- Open spot count (header)
- Room name and number
- Room type / lodging type / bed type
- Min/Max occupancy
- Per-night pricing (informational; paid directly to the hotel)
- Room Lead name (or "OPEN" if no Room Lead has claimed the room; "Anonymous" if Room Lead has privacy enabled)
- Each bed spot with occupant scene name or "OPEN" status (highlighted yellow)
- Reserved rooms/beds are not shown to Users

The Hotel Map Image, if uploaded by the EP, is displayed above or alongside the grid as a static reference image.

A one-click report download is available from this view.

The action available on each card differs by role:
- **Room Lead:** Can claim an unclaimed room (no Room Lead assigned yet); becomes the Room Lead of that room
- **Roommate:** Can apply for an open bed spot in any room that already has a Room Lead

**Room Lead Flow:**
1. User's ticket type designates them as a Room Lead
2. If `room_required_at_purchase` is enabled: room selection occurs during ticket checkout; room is auto-locked in the platform on ticket purchase completion
3. If not required at purchase: Room Lead accesses the room selection grid (see Room Selection UI below), optionally views the Hotel Map Image for reference, selects a room, reviews details and pricing, and confirms the selection
4. Platform records the room selection; portal and email confirmation updated immediately
5. Room Lead can fill open spots two ways (both flows operate simultaneously):
   - **Roommate applies:** Roommates browse the grid and apply for open bed spots independently (§6.3 Roommate Flow)
   - **Room Lead claims by email:** From the "Find a Roommate" panel on the Room Lead's room detail page, the Room Lead enters a user's email address; the platform checks eligibility (all prerequisite modules complete per event workflow); if eligible, sends a claim notification (see §6.12 row 29) and creates a `roommate_applications` record with `initiated_by = 'room_lead'`; if ineligible, returns "This user has not completed the required steps to be eligible"
6. Room Lead receives notifications for incoming roommate applications (row 7) and claim responses (rows 30–31); can accept or decline each
7. **Conflict resolution:** When Room Lead accepts any application or claim for a specific bed spot, all other pending applications/claims for that same spot are automatically set to `superseded`, and those users receive decline notifications (row 9)
8. When reviewing a Roommate application or claim, Room Lead sees: applicant's scene name + any social media links on their profile; no PII (no email, phone, DOB)

**Roommate Flow:**
1. User's ticket type designates them as a Roommate
2. User accesses the Room Selection module (room selection grid)
3. Browses rooms; open bed spots highlighted in yellow; sees Room Lead name (or "Anonymous"/"OPEN"), occupancy details, and per-night pricing
4. Submits application for a bed spot in a chosen room
5. Receives email and Telegram notification on acceptance/decline
6. Portal updates in real time
7. User must lock in a room before the Lock-In Date

**Event Promoter Room Controls:**
- Block/unblock rooms or individual beds at any time (whole-room: `event_room_config.blocked`; per-bed: `bed_blocks` table)
- Reserve entire Rooms, Room Groups, or individual bed spots (with optional user-visible or admin-only notes)
- Notes persist in the audit log
- Can assign users to rooms manually with the following warning protections (each requires explicit EP confirmation before proceeding):
  1. **Exceeds bed_spot_count** — "This room is at or above max occupancy. Proceed anyway?"
  2. **User already has a room** — "This user is currently in [Room Name]. Assigning will move them. Proceed?"
  3. **Room is blocked or reserved** — "This room is currently [blocked/reserved]. Assigning a user will not unblock it. Proceed?"
  4. **User hasn't met prerequisites** — "This user has not completed [list of unmet required modules]. Proceed anyway?"
- Can assign "Room Open Group" to incrementally open rooms to specific attendees

**Lock-In Process:**
- Users may freely change room selection in the platform until the Lock-In Date
- Users can signal readiness to lock early ("Ready to Lock")
- Event Promoter receives notification and manually locks users who declare "Ready to Lock"
- System automatically locks remaining room selections on the Lock-In Date
- A "locked" room is a platform confirmation of the user's intended room; the user is responsible for paying the hotel directly
- Post-lock: no user changes to room selection; Event Promoter approval required for any modifications
- On Lock-In Date: system sends an attendance slip to all locked users via **email (Postmark) and Telegram message**; content is system-generated with no Event Promoter template required; content includes: user's scene name, event name, room number, room type, room code, check-in date, check-out date, and instruction to present the room code to hotel desk staff at check-in
- Users without locked rooms receive automated notifications prompting resolution

**Room Closed Date:** Goal is confirmed room locks for all attendees by this date. Event Promoter manages resolution of any outstanding issues.

**Event Promoter Communicates to Hotel:** Room Lock List is communicated to venue desk staff. Rooms may only be sold with confirmed room codes. Venue staff confirms room code, scene name, and DOB at check-in.

**Automated Hotel Reporting (Required):**
- Weekly scheduled email to hotel with two attachments: Excel file and PDF
- **Recipient email:** `platform_events.hotel_contact_email` if set; otherwise falls back to `venues.email` for the event's venue
- Contents: full master room list with guest names, room types, booking status
- Changes since previous week highlighted in yellow in the Excel file
- Change summary as bullet points in email body
- If no changes: email still sent with body stating "No changes from previous week"
- System logs all sent emails and files
- Triggered by external scheduler (Supabase Edge Function, Zapier, or cron) calling `/api/reports/hotel-weekly` — not by `setInterval` or in-process timer

---

### 6.4 Volunteer Module

**Core Functionality:**
- Signup dashboard displaying available volunteer shifts in chronological order
- Users can sign up for and remove themselves from shifts at any time before Event Close
- A user may volunteer for multiple shifts but never the same shift twice and never overlapping shifts
- Event Promoter view: modify volunteer schedule, add/remove users from the event volunteer pool

**Connections to Other Modules:**
- Schedule → Volunteer: Schedule blocks marked "Open to Volunteers" with a desired volunteer count communicate to the Volunteer module
- Volunteer → Ticketing: Ticket types that require volunteer hours insert a shift selection step into checkout
- There may always be more volunteers than requested for any given shift

**Completion Tracking:**
- Event Promoter can mark individual volunteer signups as `completed` or `no_show` after the event. "Area Lead" is a display label only — it does not grant platform access.
- This is record-keeping only; it does not gate or affect any other user workflow

**Required Hours Per Ticket countdown display:**
- Shown on the user's portal and on the volunteer shift selection page
- Displays: confirmed signed-up hours ÷ hours required by ticket type (e.g., "3 of 4 required hours selected")
- Based on confirmed shift signups; does not change based on post-event completion marks

**Additional Requirements:**
- Area Lead label — Event Promoter can assign an "Area Lead" label to a `UserVolunteerSignup` record for organizational purposes; this is a data field, not a platform role

---

### 6.5 Schedule Module

The Schedule Module is recreated within the SD Platform. The existing standalone Schedule app will not be used.

**Event Promoter Capabilities:**
- Enable the Schedule Module for an Event
- Add activities to the event schedule

**Required fields per activity:**
- `name` — activity name
- `date_time` — date and time the activity occurs
- `duration` — length of the activity
- `description` — brief description

**Optional fields per activity (Volunteer integration):**
- `volunteers_requested` (boolean) — whether this activity requests volunteers
- `volunteer_count` — number of volunteers requested
- `volunteer_shift_duration` — length of volunteer shifts
- `volunteer_shift_date_time` — date and time of volunteer shifts

> **Note:** The volunteer-specific optional fields are required if the Event Promoter wants the Schedule → Volunteer module integration to function for that activity.

---

### 6.6 Waiver Module

The Waiver Module is implemented via Odoo, which has a native feature that meets the platform's requirements. The SD Platform integrates with Odoo for waiver collection and status tracking.

A Waiver Template document is required per Event for this module to be enabled. Integration between SD Platform and Odoo is via API.

---

### 6.7 Badge Module

The existing badge-maker codebase is absorbed as-is into the platform as the Badge Module. A Badge Template is required per Event for this module to be enabled. See §3 for full integration details.

---

### 6.8 Telegram Bot

**Library:** `grammY` — TypeScript-first, webhook-native. The bot runs in webhook mode via a Next.js Route Handler (`/api/telegram/webhook`). Polling is not used (incompatible with Hostinger's single-process model).

**Bot setup:** The bot token is stored in `TELEGRAM_BOT_TOKEN` (environment variable). The webhook URL is registered with Telegram once at deployment pointing to `/api/telegram/webhook`.

**Commands / Capabilities:**
- `/start` — Display intro help message explaining available commands and how to get assistance
- Help desk message routing — messages sent to the bot are routed to the Odoo Help Desk integration (`// TODO: Odoo integration — not implemented`)
- Automated volunteer shift reminders — see §6.12 Notification Inventory (rows 17–21) for timing
- Channel / group chat enrollment — bot generates a one-time invite link for the target channel or group and sends it to the user via DM; invite links are tracked in the existing `telegram_invites` table (badge-maker table, read-only from platform — platform writes new invite records via the Supabase service role key)
- Ticket help and refund/exchange routing — routes user messages to help desk

**Platform Integration** (outbound messages sent by the platform via bot):
- Room application accept/decline notifications (see §6.12 rows 8–9)
- Room lock-in deadline reminders (see §6.12 rows 12–13, 17)
- Attendance slip delivery on Lock-In Date (see §6.12 row 11)
- General event status notifications (see §6.12 row 25)
- User locked by EP notification (see §6.12 row 14)

**Telegram handle lookup:** All outbound messages use the user's stored `telegram_handle` (without `@`). If the handle is unverified or blank, the notification is skipped and logged as undelivered.

---

### 6.9 Portal (Attendee Dashboard)

**User Landing Page:**
- List of events the user is attending, in chronological order (soonest first)
- Event cards showing high-level details and status summary of critical steps
- Countdown timer showing time remaining to secure a room (disappears once room is confirmed)
- Click event card → Event Attendee Page

**Event Attendee Page:**
- Central management page for all event-related actions
- Module statuses shown as cards (Application, Waiver, Ticket, Room, Volunteer, Badge, etc.)
- Cards indicate current status and any pending user action
- Click module card → module management page

---

### 6.10 Event Promoter Dashboard

**Main Dashboard:**
Displayed in priority order:
1. Critical notifications requiring Event Promoter action
2. Upcoming events in reverse chronological order
3. Warning and lower notifications
4. Draft events

All shown in Card format. Clicking a card navigates to the corresponding management page.

**Event Promoter Capabilities Summary:**
- User Management (within their events)
- Event Management (create, configure, status transitions)
- Venue Management (create venues, room matrices via manual entry or CSV upload, room groups)
- Volunteer schedule management
- Room reservations and blocking

> **Registration Panel:** Deferred to MVP 2 (when QR code check-in is built). In MVP 1, on-site check-in is handled by a separate dedicated application — not the SD Platform. The `Registration` status signals the check-in phase is active; no platform UI is needed in MVP 1.

---

### 6.11 System Administrator Panel

**System Administrator Capabilities:**
- Platform-level configuration
- User role management (designate Users as Event Promoters)
- System-wide settings and integrations
- Access to all Event Promoter capabilities

> **Note:** A default System Administrator account is created automatically on first deployment with known credentials. This account should be secured immediately after initial setup.

---

### 6.12 Notification Inventory

Complete inventory of all platform notifications. Every entry must be implemented — omissions will result in silent failures and poor attendee experience.

**EP Notification Preferences:** Event Promoters configure notification channels per notification type via their profile settings. The `notification_preferences` JSONB field on the EP's `platform_users` record stores per-type preferences:
```json
{
  "application_submitted": { "in_platform": true, "email": false, "telegram": false },
  "application_updated":   { "in_platform": true, "email": false, "telegram": false },
  "ready_to_lock":         { "in_platform": true, "email": true,  "telegram": false }
}
```

| # | Trigger | Recipient | Channel | Required Content Fields |
|---|---|---|---|---|
| 1 | Account created — email unverified | New user | Email | Verification link |
| 2 | Password reset requested | User | Email | Reset link |
| 3 | Email change requested | User (at new email address) | Email | Verification link; note: on confirm, user is logged out |
| 4 | Application submitted | Event Promoter | Configurable per EP preferences | User scene name, event name |
| 5 | Application updated / re-submitted | Event Promoter | Configurable per EP preferences | User scene name, event name |
| 6 | Room Lead confirms room selection | Room Lead | Email | Event name, room number, room type, check-in date, check-out date |
| 7 | Roommate applies for bed spot | Room Lead | Email + Telegram + in-platform | Applicant scene name, event name, room/spot requested |
| 8 | Room application accepted | Roommate | Email + Telegram | Event name, room number, room type |
| 9 | Room application declined | Roommate | Email + Telegram | Event name |
| 10 | User signals "Ready to Lock" | Event Promoter | Configurable per EP preferences | User scene name, event name |
| 11 | Lock-In Date reached — room locked | All users with locked rooms | Email + Telegram | Scene name, event name, room number, room type, room code, check-in date, check-out date, instruction to present room code to hotel desk staff at check-in |
| 12 | 1 week before Lock-In Date — room not locked | Users without locked rooms | Email + Telegram | Lock-in date, prompt to select and lock room |
| 13 | 48h before Lock-In Date — room not locked | Users without locked rooms | Email + Telegram | Lock-in date (urgent), prompt to resolve |
| 14 | User locked by Event Promoter | Locked user | Email + Telegram | Event name, confirmation that no further changes can be made |
| 15 | Ticket purchased | User | Email | Ticket type, event name, amount paid, order ID |
| 16 | Refund processed | User | Email | Refund amount, event name, original order ID |
| 17 | Volunteer shift: 24h before start | Signed-up volunteer | Telegram | Shift name, shift start time, event name |
| 18 | Volunteer shift: 8h before start | Signed-up volunteer | Telegram | Shift name, shift start time |
| 19 | Volunteer shift: 3h before start | Signed-up volunteer | Telegram | Shift name, shift start time |
| 20 | Volunteer shift: 1h before start | Signed-up volunteer | Telegram | Shift name, shift start time |
| 21 | Volunteer shift: 15min before start | Signed-up volunteer | Telegram | Shift name — final reminder |
| 22 | Telegram handle verification (bot-initiated) | User | Telegram (bot) | One-time verification code |
| 23 | Weekly hotel report (fixed weekly schedule) | Hotel / Venue | Email | Excel attachment + PDF attachment; change summary bullets in body, or "No changes from previous week" if unchanged |
| 24 | `/start` command | User | Telegram | Intro help message |
| 25 | Event status change | Event attendees | Telegram | Event name, new status |
| 26 | New attendee enrolled in event | User | Telegram | Added to event announcement channel / group chat |
| 27 | Area Lead label assigned to volunteer signup | Volunteer (user) | Email + Telegram | Shift name, event name, "You have been designated as Area Lead for this shift" |
| 28 | Area Lead label removed from volunteer signup | Volunteer (user) | Email + Telegram | Shift name, event name |
| 29 | Room Lead claims user by email (claim-by-email flow) | Claimed user | Email + Telegram + in-platform | Room Lead scene name, room name/number, event name, "Accept or decline in your portal" |
| 30 | Claimed user accepts Room Lead's claim | Room Lead | Email + in-platform | Accepted user's scene name, event name, room number |
| 31 | Claimed user declines Room Lead's claim | Room Lead | Email + in-platform | Declined user's scene name, event name |

> **Scheduled notifications** (rows 12, 13, 17–21, 23) must be triggered by an external scheduler (Supabase Edge Functions, Zapier, or cron service) calling an API Route Handler — never by `setInterval`, `setTimeout`, or in-process timers (see §2 Hostinger constraints).

> **Offline Reporting Packet trigger** (see §10): When the event transitions to `Event Locked`, the Server Action sets a job flag. An external scheduler calls `/api/reports/offline-packet` to generate and email the report. Do NOT generate it inline in the status-transition Server Action.

> **In-platform messaging (Odoo Help Desk):** The messaging panel UI is future-state only. In MVP 1, no in-platform messaging UI exists. All support communication uses email (Postmark). The Odoo Help Desk integration is implemented as a stub (`// TODO: Odoo integration — not implemented`) at each integration point.

> **User notification preferences:** Regular users can toggle `email_notifications_enabled` and `telegram_notifications_enabled` globally from their Profile Management page. They cannot opt out per notification type. `telegram_notifications_enabled` defaults to `false` and activates automatically when `telegram_verified` becomes `true`.

---

## 7. User Workflows

### Complete Attendee Workflow (COG)

```
Event Promoter: Venue Created
Event Promoter: Event Created
─────────────────────────── Manual Action
Event Promoter: Opens Event
User: Applies to Event
Event Promoter: Approves User Application
─────────────────────────── Checkpoint
User: Ticket Purchased
User: Waiver Signed (via Odoo)
─────────────────────────── Checkpoint
Event Promoter: Opens Rooms
User: Room Selected
User: Volunteer Shifts Selected (if required)
User: Badge Maker Completed
User: Signals "Ready to Lock"
Event Promoter: Locks User (manual, triggered by "Ready to Lock" signal)
  OR System: Auto-locks remaining users on Lock-In Date
─────────────────────────── Event Locked
System/Event Promoter: Locks Attendees on Lock-In Date
Event Promoter: Communicates Room Lock List to Venue Desk Staff
Event Promoter/Venue Staff: Coordinate, confirm room locks, resolve issues
─────────────────────────── Event Start
Event Promoter/User: Registration (on-site check-in via separate application — not SD Platform)
```

> **On-site check-in:** The SD Platform does not perform digital check-in in MVP 1. The `Registration` status signals that the check-in phase is active. Actual attendee check-in (identity verification, room code confirmation) is handled by a separate dedicated application and by hotel/venue desk staff. QR code check-in within the SD Platform is an MVP 2 feature.

### Configurable Workflow

The event workflow uses a two-tier status architecture:

**What is fixed:** The 7 system-fixed statuses (`Draft`, `Published`, `Event Locked`, `Registration`, `Happening Now`, `Closed`, `Archived`) are always present and cannot be renamed or removed.

**What is configurable:** Between `Published` and `Event Locked`, the Event Promoter can add any number of free-form, custom-named intermediate statuses. These define the visible progression of the event.

**What Event Promoters define:**
- Custom intermediate status names and their order
- Which status triggers each enabled module to open (with manual override always available)
- Which modules are required vs. optional for attendees at each step
- Module open and close triggers: which workflow status opens each module (`opens_at_status`) and which closes it to read-only (`closes_at_status`; null = open until Event Locked)
- Attendee eligibility: when a module opens, it is accessible only to attendees who have completed all required modules from prior statuses in the workflow order; eligibility is computed automatically from module completion states (see §5 Module Configuration)
- What attendee actions are required for a user to reach "Event Locked" status

**Example full workflow** *(fixed statuses in brackets, custom statuses unbracketed):*
```
[Draft] → [Published] → Applications Open → Applications Closed →
Tickets Open → Tickets Closed → Rooms Open → Rooms Closed →
[Event Locked] → [Registration] → [Happening Now] → [Closed] → [Archived]
```

**Example minimal workflow** *(fewer custom statuses configured):*
```
[Draft] → [Published] → BUY YOUR TICKET → TICKETS CLOSED →
[Event Locked] → [Registration] → [Happening Now] → [Closed] → [Archived]
```

---

## 8. Event Promoter Workflows

### Venue & Room Setup

1. Create Venue (name, address, optional contact info)
2. Create Room Matrix for the Venue
   - Create rooms individually, in batches, or via CSV upload (specify count, name, bed spots, optional details)
   - Assign rooms to Room Groups as needed
3. Before event rooms go live: use blocking/reservation tool to remove staff, volunteer, and play rooms from the available pool

### Event Setup

1. Create Event (title, description, dates, location)
2. Configure Ticketing module (required): define ticket types, roles (Room Lead / Roommate), pricing, volunteer hours
3. Enable and configure optional modules
4. Define attendee workflow statuses and module requirements
5. Configure Cancellation Policy checkpoints and refund percentages
6. Save as Draft → Publish when ready to market
7. Transition through statuses as the event progresses

### Room Lock Management

1. Monitor Room Lock Change Report for users who have changed room selections
2. Lock users who signal "Ready to Lock" as they come in
3. On Lock-In Date: system auto-locks all remaining rooms; Event Promoter reviews Room Lock Issue Report for missing locks
4. Compile and communicate Room Lock List to venue desk staff
5. Coordinate with venue to confirm room purchases using room codes
6. Resolve any outstanding issues before Room Closed Date

---

## 9. User Stories

### Story 1: Room Lead Booking

As a room lead, after completing ticket and merchandise checkout, if configured to do so by the Event Promoter, the system directs me to the Room Selection module's room grid. If the Event Promoter has uploaded a Hotel Map Image, it is displayed above the grid as a static reference. I browse the room grid, click the room I want, review details and pricing (paid directly to the hotel — not through the platform), and confirm my selection. My room is confirmed in the platform and my portal updates immediately with room number, room type, and check-in details. The room appears as unavailable in the grid.

If room selection was required as part of my ticket purchase, my room is automatically locked in the platform when my ticket checkout is complete.

I have the ability to fill open spots in my room two ways. From the "Find a Roommate" panel on my room detail page, I can enter a user's email address to claim them as a roommate. The platform checks eligibility (user must have completed all prerequisite modules per the event workflow — e.g., if a ticket is required before room selection, the claimed user must have a ticket). If eligible, that user is notified of my claim (notification row 29) and can accept or decline. If they accept, they are placed in my room. Open spots are also filled when Roommates browse the Roommate Finder and apply independently (see Story 2). Both flows operate simultaneously. If I accept either an application or a claim for a specific bed spot, all other pending applications and claims for that spot are automatically declined.

On my Profile page, I can toggle my name to be hidden in the Roommate Finder. If so, the Roommate Finder shows that my spot is taken anonymously.

### Story 2: Roommate Booking

As a roommate with a ticket but no room, my portal shows a countdown timer to the room lock deadline. I access the Roommate Finder, which shows all rooms with open spots highlighted in yellow. I can browse, view room details, see the room lead (unless private), and apply for a bed spot.

After applying, I wait for the room lead's decision. I receive email and Telegram notification on acceptance or decline. My portal updates in real time. Once accepted, I see my confirmed room details and the countdown timer disappears.

On my Profile page, I can toggle my name to be hidden in the Roommate Finder. If so, the Roommate Finder shows that my spot is taken anonymously.

### Story 3: Hotel Communication

As the hotel, I receive a weekly scheduled email with two attachments (Excel and PDF) containing the full master room list: guest names, room types, and booking status. Changes since the previous week are highlighted in yellow in the Excel file and summarized as bullet points in the email body. If there are no changes, the email still arrives and states "No changes from previous week." The system maintains a log of all these emails and files.

### Story 4: Event Promoter Room/Bed Blocking and Reservation

As an event promoter, I can block any room from the event promoter panel to remove it from the Room Selection module's room grid and the Roommate Finder immediately. I can add a free-text note (e.g., "Staff", "Playroom", "Hotel Maintenance") visible only to event promoters, persisted in the audit log. I can also block at the bed level to reduce a room's capacity without removing it entirely. Unblocking a room or bed immediately returns it to the available pool.

I can also Reserve entire Rooms, Room Groups, or individual bed spots. I can attach a note to the reservation that can optionally be displayed to Users. Reserved items do not appear as available in the Roommate Finder.

### Story 5: User Account Creation

As a new user, I create an account using my email address (the same one used for prior Shiny Dog ticket purchases, if applicable), password, and date of birth. Users under 21 are denied. Optional fields include scene names, social media, and a profile picture. After submission, I receive an email verification link I must click to activate my account.

### Story 6: User Login & Landing Page

As a user, I provide my email and password to log in, with a password reset option available. After authentication, I am shown the User Dashboard listing events I am attending as cards in chronological order, with status summaries of critical steps. Clicking an event card takes me to the Event Attendee Page.

### Story 7: Event Attendee Page

When I click an Event Card, I am brought to the Event Attendee Page — the central hub for managing my attendance. Modules (Application, Waiver, Ticket, Room, etc.) are shown as status cards. I can see all pending actions at a glance and click any card to navigate to that module's management page.

### Story 8: Application Detail Page

On the Application Detail Page, I can:
1. Withdraw my application (blocked after Attendance Lock)
2. Complete an incomplete application
3. Update an in-progress application (triggers event promoter notification)
4. View a completed/approved/closed application

The form is pre-populated with my previous responses. Submissions that fail validation are blocked. Submission triggers an event promoter notification.

### Story 9: Profile Management

From the Profile Management page (accessed via Top Navigation), I can update my scene names, preferred scene name, social media links, profile picture, and zip code.

**Email Change:** I can request an email change by providing the desired new address, responding to a verification email sent to that new address. Upon confirmation, I am logged out and must use the new email to log in. The new email must not already exist on the platform.

### Story 10: Event Promoter Main Dashboard

After login, I am directed to the Event Promoter Main Dashboard showing (in priority order): Critical Notifications, Upcoming Events (reverse chronological), Warning/lower notifications, Draft Events — all in Card format. Clicking a card navigates to the corresponding management page.

### Story 11: Event Creation — Event Promoter

From the Event Management page, I create an Event with required parameters (title, description, start/end date, location). I must configure the Ticketing module, which is the only required module. I optionally enable and configure additional modules, define the workflow and gating structure, configure the Cancellation Policy, and save as a Draft or cancel.

### Story 12: Venue Creation — Event Promoter

From Venue Management, I create a Venue with name and physical address (required) plus optional website, email, and phone.

### Story 13: Room Matrix Creation — Event Promoter

From the Venue Configuration page, I create rooms by specifying count, name, and bed spot number (required), plus optional room number, description, lodging type, room code, and pricing. Rooms can be created individually, in batches, or by uploading a CSV file. Created rooms appear on the Venue Configuration page. Rooms can be assigned to Room Groups. Room information feeds into ticketing and room selection modules when enabled.

---

## 10. Reporting Requirements

### Room Lock Change Report

Identifies users who have changed their room lock before the lock date. Indicates the user may not have completed their room purchase, or believes any room selection is valid with their purchase. Used by Event Promoter to facilitate proactive resolution.

### Room Lock Issue Report

Identifies users with missing confirmed room locks post lock date. A missing confirmed room lock is an issue requiring Event Promoter follow-up.

### Hotel Weekly Room Report

See §6.3 and User Story 3 for full specification. Delivered automatically on a fixed weekly schedule. Excel and PDF formats. Changes highlighted. No-change weeks still generate a delivery.

### Offline Reporting Packet

A bulk report packet containing all critical event information formatted for offline use at the event in case internet is unavailable. Serves as a complete operational backup.

**Format:** Excel (`.xlsx`) — multiple tabs, one per report section. Delivered to the EP via email (Postmark).

**Trigger:** When the event transitions to `Event Locked` status, the Server Action sets a job flag (or inserts a pending job record). An external scheduler (Supabase Edge Function, Zapier, or cron) calls `/api/reports/offline-packet` to generate and email the report. Do NOT generate inline in the Server Action — this would block the status transition and violate the no-background-work constraint. The EP may also manually regenerate and re-download from the event management panel at any time after `Event Locked`.

**Contents (one tab per section):**

| Tab | Contents |
|---|---|
| Attendee Room List | All locked attendees: scene name, room number, room type, room code, check-in date, check-out date — sorted by room number |
| Room Lock Status | Room Lock Issue Report (users missing a confirmed lock) and Room Lock Change Report (users who changed room selection before lock) |
| Volunteer Schedule | All volunteer shifts with shift name, date/time, duration, capacity, and assigned volunteers (scene names) — sorted by shift start time |
| Event Schedule | All schedule activities with name, date/time, duration, description, and volunteer count requested — sorted by start time |

---

## 11. MVP Scope

### MVP 1 — Target: May Ticket Opening

- Ticketing
- Hotel Room Selection
- Attendee Portal
- Telegram Bot (basic)
- Email & Telegram Alerts
- Schedule
- Badge Maker
- Waiver (via Odoo)
- Volunteering

### MVP 2 — Target: Before First October Event

- Media Collection & Hosting / Gallery
- QR Codes for Registration / Check-In (Registration Panel in EP Dashboard)
- Content Media — User Claim Workflow
- In-platform messaging / Odoo Help Desk integration

### Future (Post-MVP)

- Public User Profile Browse ("The Registry") — **currently excluded per decision**
- Event-specific Attendee Profile Browse — **currently excluded per decision**
- Hotel Room API Integration for automated room status polling
- Patreon-style community building features
- Rich social media integration

---

## 12. Open Questions & Notes

### Decisions Needed

- **[BLOCKER] Odoo Integration (Waiver):** Odoo handles Waiver signing, CRM, and Email Marketing via API, but no API credentials, deployment URL, authentication mechanism, or endpoint details have been specified. Claude Code must scaffold stub functions at each Odoo integration point (waiver status sync, CRM contact sync, email marketing enrollment) and mark them `// TODO: Odoo integration — not implemented`. Integration cannot be completed until Odoo deployment details are provided. This is a pre-launch requirement for the Waiver module.
- **[POST-MVP] Odoo Help Desk:** In-platform messaging routes to Odoo Help Desk. This is MVP 2. In MVP 1: no messaging UI; all support via email (Postmark). Stub at Odoo integration points with `// TODO: Odoo integration — not implemented`.
- **[POST-MVP] Age Verification API:** Online age verification is a one-time profile-level check (not a checkout gate). A provider must be selected before implementing. The `verifyAge()` hook is scaffolded with a stub implementation. All in-person ID verification at check-in is handled by a separate application regardless of online verification status.

### Technical Notes

- **Race Condition Prevention:** Soft locks for tickets, shifts, rooms, and merchandise during checkout are implemented via the `locks` table (see §5a). Valid `resource_type` values: `ticket`, `shift`, `room`, `merchandise`. Lock expiry: 15 minutes. In-memory locking (`setInterval`, shared `Map`, etc.) is not permitted.
- **Event Promoter Room Override:** EPs can assign any user to any room with four warning checks (see §6.3). Each warning requires explicit EP confirmation.
- **Room Code Integrity:** Room codes are free text provided by the EP or hotel. The platform does not generate codes. The system is in the critical path for hotel check-in — the EP must ensure codes are accurate in the platform before communicating the Room Lock List to venue staff.
- **Payment provider per transaction:** `orders.payment_provider` is locked at transaction time. Refunds always use the provider from the original order record. See §4 for full architecture.
- **Status UUID references:** `module_config` and `cancellation_policy` store UUID references to `workflow_statuses` entries, not display names. Renaming a status updates only its `name` field; all references remain intact.
- **Offline Reporting Packet:** Triggered by external scheduler after event transitions to `Event Locked` — never inline in the Server Action. See §10.
- **Hotel contact email:** Stored on `venues.email` (default) and overridable per-event via `platform_events.hotel_contact_email`. Weekly hotel reports use the override if set.
- **Event discovery:** Authenticated users browse events via `GET /api/events` Route Handler using service role key. Returns only events with status ≥ `Published`. No PII exposed.
- **Room Open Group:** See the Room Open Group data model in §5 for full specification. Distinct from Room Group (static grouping for blocking/ticketing).
- **Zapier:** An existing paid Zapier subscription should be retained regardless of whether it is used directly in the platform, as it provides workflow glue for badge-maker integrations.
- **Default System Administrator:** A default System Administrator account is created on first deployment. Credentials must be documented and secured immediately after initial setup.
- **Deployment Target:** Hostinger Node.js Web Apps via GitHub/hPanel integration. Full deployment constraints, Dockerfile, and docker-compose configuration are specified in §2.
- **Telegram local dev:** For local bot testing, run `ngrok http 3000` to expose `localhost:3000` publicly and register the ngrok URL as the bot's temporary webhook. Document this in `scripts/register-telegram-webhook.sh`. The grammY library requires no code changes between dev and prod webhook modes.
- **COG room CSV:** The `COG Room Price_Min_Max - SD Platform Template.csv` file in this repo uses old column headers not recognized by the current importer. It is historical reference only — not importable as-is.

### Build Tooling Notes

The recommended AI-assisted development workflow is a "layer cake" approach:
- Claude: Write Product Requirements Document (PRD) from whiteboard slides
- Claude Code: Build from PRD
- ChatGPT / Gemini: Code review
- Human: Platform whiteboard → end-to-end test of site flow

---

## 13. Development Seed & Verification

### Seed Script

- **Location:** `scripts/seed.ts`
- **Run:** `npm run seed`
- **Warning:** Development and staging environments only. Must never run against production.
- **Purpose:** Populate the database with enough data to manually walk through every module flow.
- **Auth user creation:** Use `supabase.auth.admin.createUser()` with `SUPABASE_SERVICE_ROLE_KEY`. Pass `email_confirm: true` to bypass email verification in the seed environment. Example:
  ```typescript
  await supabase.auth.admin.createUser({
    email: 'admin@test.local',
    password: 'Admin1234!',
    email_confirm: true,
  });
  ```

### Seed Accounts

| Role | Email | Password |
|---|---|---|
| System Administrator | `admin@test.local` | `Admin1234!` |
| Event Promoter | `promoter@test.local` | `Promo1234!` |
| User — Room Lead | `user1@test.local` | `User1234!` |
| User — Roommate | `user2@test.local` | `User1234!` |
| User — Roommate | `user3@test.local` | `User1234!` |
| User — Volunteer ticket | `user4@test.local` | `User1234!` |
| User — no ticket yet | `user5@test.local` | `User1234!` |

All user accounts have `date_of_birth` set to 30 years before the current date (valid age). `roommate_finder_hidden` is false for all users except user3 (set to true, to verify anonymous display).

### Seed Venue

- **Name:** Test Venue
- **Rooms:** 10 total — King Studio ×3, Queen Double ×4, Bunk Room ×3
- **Bed spots:** 2–4 per room (varies by type)
- **Pricing:** `room_daily_rates` set for 3 nights with different per-night rates
- **Blocking:** 2 rooms pre-blocked (one labeled "Staff", one labeled "Playroom") to verify blocking UI

### Seed Events

**Full Test Event** (all modules enabled):
- Status: custom intermediate status "Tickets Open" (after "Applications Open")
- Modules: Application, Ticketing, Room Selection, Volunteer, Schedule, Badge, Waiver
- Ticket types (all $0 for testing):
  - "Room Lead Pass" (`room_lead: true`, `room_required_at_purchase: false`)
  - "Roommate Pass" (`room_lead: false`)
  - "Volunteer Pass" (`room_lead: false`, `volunteer_hours_required: 4`)
- Cancellation Policy: 2 checkpoints (status UUID of "Applications Open" → 100%, status UUID of "Tickets Open" → 50%)
- Merchandise: 2 items — "Event T-Shirt" ($0, unrestricted); "VIP Lanyard" ($0, restricted to Room Lead Pass ticket type ID)
- 3 volunteer shifts created (one overlapping pair, to verify overlap constraint)
- Pre-seeded state:
  - user1 has Room Lead ticket + completed order; `is_room_lead = true`
  - user2 + user3 have Roommate tickets + completed orders
  - user4 has Volunteer ticket + completed order
  - user5 has no ticket

**Minimal Test Event** (ticketing only):
- Status: "Tickets Open"
- Modules: Ticketing only
- 1 ticket type at $0

### Manual Verification Checklist

After running `npm run seed`, walk through these flows in order:

1. **User registration** — Create a new account with a valid DOB; verify email verification is required; attempt registration with a DOB under 21 and verify rejection.

2. **User login** — Log in as `user5`; verify the portal landing page shows the Full Test Event card.

3. **Ticket purchase** — As `user5`, purchase a Room Lead ticket on the Full Test Event; verify room selection becomes accessible in the portal after purchase.

4. **Module gating** — As `user3` (Roommate ticket, no room selected), attempt to access the Volunteer signup page; verify it is gated until prerequisites are met per the event's workflow configuration.

5. **Room selection (Room Lead)** — As `user1`, open the room selection grid and select a room; verify the room appears as unavailable in the grid and the portal updates immediately.

6. **Roommate Finder** — As `user2`, browse the Roommate Finder; verify `user3`'s name shows as "Anonymous" (privacy enabled); apply for a spot in `user1`'s room; verify `user1` receives a notification.

7. **Roommate accept/decline** — As `user1`, accept `user2`'s room application; verify `user2`'s portal updates and countdown timer disappears.

8. **Volunteer shift signup** — As `user4`, sign up for a volunteer shift; verify the hours countdown updates; attempt to sign up for an overlapping shift and verify rejection.

9. **Ready to Lock → Lock** — As `user1` (all required modules complete), signal "Ready to Lock"; log in as Event Promoter and lock `user1`; log back in as `user1` and verify room selection can no longer be changed.

10. **Event Promoter room block** — As Event Promoter, block an unblocked room with a note; verify the room disappears from the Roommate Finder immediately.

11. **System Administrator** — Log in as System Admin; designate a new user as Event Promoter; verify the designated user now has Event Promoter access; verify platform-level config is inaccessible to the Event Promoter account.

12. **Permissions check** — Log in as `user2`; attempt to access `user1`'s profile page directly; verify only Roommate Finder card data is available and no PII (email, DOB, address) is exposed.

13. **Merchandise in checkout** — As `user5`, begin purchasing a Roommate Pass; verify both merchandise items appear in checkout; verify the "VIP Lanyard" (Room Lead-restricted) is NOT shown for a Roommate Pass; complete purchase at $0.

14. **Room Lead claim-by-email** — As `user1` (Room Lead with a room selected), open the "Find a Roommate" panel; enter `user5@test.local`; after user5 purchases a Roommate ticket (step 13), verify user5 is eligible and the claim sends notification row 29; log in as `user5` and accept; verify user5 is placed in user1's room; verify that if user2 had an open application for the same bed spot, they receive a decline notification (row 9).

15. **Reverted approval modal** — As Event Promoter, change `user1`'s `application_status` from `Approved` back to `Declined`; verify the two-option modal appears (cancel+refund vs. block access); choose "Block portal access only"; verify `user1` cannot access the Room Selection module; verify their ticket is preserved.

16. **Bed blocking** — As Event Promoter, block bed #1 of a room that has 3 bed spots; verify the Roommate Finder shows 2 open spots instead of 3 for that room; attempt to assign a user to bed #1 and verify it is blocked.

17. **Status UUID references** — Rename the "Tickets Open" workflow status to "Tickets Are Now Open" on the Full Test Event; verify module triggers still fire correctly when the event is advanced to that status; verify the new display name appears correctly in the UI.

18. **Telegram notifications default** — Register a new user with a `telegram_handle`; verify `telegram_notifications_enabled = false`; verify the platform bot sends a verification code; complete Telegram handle verification; verify `telegram_notifications_enabled` automatically switches to `true`.

19. **Event discovery** — Log in as `user5` (before enrolling in any event); verify `GET /api/events` returns the Full Test Event with status ≥ Published; verify no PII fields (email, DOB, owner details) are in the response.

20. **Merchandise restriction** — As Event Promoter, verify the "VIP Lanyard" merchandise item does NOT appear in checkout for a user purchasing a Roommate Pass; verify it DOES appear for a user purchasing a Room Lead Pass.
