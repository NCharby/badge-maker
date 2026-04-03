# Phone App Integration — Schedule & Notifications
**Date:** 2026-03-31
**Scope:** Serving schedule data and push notifications to an independently developed phone app

---

## Overview

A companion phone app that shows event schedules and delivers push notifications for events a user is attending requires only a small amount of new platform work. The platform stores all data and acts as the backend; the phone app is a read-only consumer plus notification recipient.

Total estimated platform effort: **one sprint.**

---

## Component Breakdown

### 1. Schedule API Endpoint — Very Easy (1–2 days)

The `schedule_activities` table already contains everything the phone app needs. A single new protected Route Handler is all that is required:

```
GET /api/user/schedule
```

Returns all schedule activities across every event where `event_attendees.user_id = authenticated user`. The response filters by the user's enrolled events automatically. The phone app fetches or polls this endpoint on demand.

No changes to existing tables, migrations, or business logic.

---

### 2. Authentication — Easy (0 platform days)

Supabase provides first-class mobile SDKs for Swift, Kotlin, React Native, and Flutter. The phone app authenticates against the **same Supabase project** the platform uses — same users, same credentials, same sessions.

The phone app developer points their Supabase client at the project URL and anon key, implements email/password login, and receives a session token that works against existing RLS policies. The platform requires **zero changes** for this.

**What the phone app developer needs:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- The schedule API endpoint spec

---

### 3. Notifications — Two Options

#### Option A: Supabase Realtime (0 platform days)

Supabase Realtime allows the phone app to subscribe directly to the `platform_notifications` table, filtered to the authenticated user's own rows. New notification records inserted by the platform are pushed to the phone app instantly via websocket.

```
Subscribe: platform_notifications WHERE user_id = <current user>
```

**Tradeoff:** The app must be open (foreground) to receive updates. No true background push delivery.

**Platform changes required:** None. The `platform_notifications` table already has the correct structure (`notification_type`, `title`, `body`, `action_url`, `event_id`).

#### Option B: True Background Push Notifications (3–5 days platform work)

Delivers notifications to the phone even when the app is closed. Requires:

**1. Device token table (new migration)**

When the phone app starts and the user grants notification permission, it receives a device push token from FCM (Android) or APNs (iOS). The platform needs to store this:

```sql
CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);
```

A new API endpoint accepts the token after login:
```
POST /api/user/device-token
Body: { token: string, platform: 'ios' | 'android' }
```

**2. Push delivery service**

The recommended service depends on what the phone app is built with:

| Phone App Stack | Recommended Service | Notes |
|---|---|---|
| Expo (React Native) | Expo Push Notifications | Single API handles both FCM + APNs |
| Native Swift / Kotlin | Firebase Cloud Messaging (FCM) | FCM handles both iOS and Android |
| Any | OneSignal | Managed service; less platform code |

A new lib file (e.g., `src/lib/push.ts`) wraps the chosen service, mirroring the pattern of `src/lib/email.ts`.

**3. Wire into existing notification dispatch**

The platform's `createInPlatformNotification()` in `src/lib/notifications.ts` already fires for every notification event. A `sendPushNotification()` call is added alongside it — same user ID, same title and body already available from the notification payload.

The `platform_notifications` table already has all the fields needed for a push payload:

| Field | Push Payload Use |
|---|---|
| `title` | Notification title |
| `body` | Notification body text |
| `action_url` | Deep link on tap |
| `notification_type` | Filter for user preferences |
| `event_id` | Context for deep link routing |

No changes to notification trigger logic — only delivery.

---

## Recommended Approach

**Start with Realtime (Option A).** It requires no platform changes, gets the phone app receiving live updates immediately, and lets the phone app team build and test the full schedule + notification UI. Add true background push (Option B) as a follow-on once the integration is proven.

---

## Platform Work Summary

| Item | Effort | Platform Changes Required |
|---|---|---|
| Schedule API endpoint | 1–2 days | New route handler |
| Authentication | 0 days | None — shared Supabase project |
| Realtime in-app notifications | 0 days | None — phone app subscribes directly |
| Background push notifications | 3–5 days | Device token table + push lib + wire into notification dispatch |

---

## What the Phone App Developer Needs

- Supabase project URL and anon key
- Schedule API endpoint specification (path, auth header format, response shape)
- `platform_notifications` table schema (for Realtime subscription)
- Push token submission endpoint spec (if background push is implemented)
- List of `notification_type` constants (see CLAUDE.md §6.12 Notification Inventory)
