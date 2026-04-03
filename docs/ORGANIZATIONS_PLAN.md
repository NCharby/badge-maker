# Organizations Feature — Requirements & Implementation Plan

**Status:** Approved — All product decisions resolved. Ready for Phase 1.
**Last Updated:** April 2026

---

## 1. Overview

An Organization is an entity that represents the organizational body that promotes and manages events on the platform. Organizations contain members at three access levels: Organization Lead, Event Promoter, and Module Lead.

Users can create an organization during account registration (free tier). Platform Administrators can create and manage all organizations.

**Key decision: There is no longer a concept of a solo Event Promoter.** All EPs must belong to an organization. A full database reset and reseed will be performed before testing this feature, so no backward-compatibility migration is needed.

---

## 2. Organization Details

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | TEXT | Yes | |
| `slug` | TEXT UNIQUE | Yes | URL-safe, auto-generated from name |
| `website` | TEXT | No | |
| `logo_url` | TEXT | No | Displayed on attendee-facing event pages |
| `social_media` | JSONB | No | Same `[{ key, value }]` pattern as `platform_users` |
| `payment_provider` | TEXT | No | `'square'` or `'paypal'` — set by OL, applies to all org events |
| `tier_id` | UUID FK | Yes | Defaults to free tier |
| `archived` | BOOLEAN | No | Default false. Archived orgs cannot create new events. |

---

## 3. Access Levels

| Level | Create Events | Manage All Org Events | Promote to OL | Promote to EP | Promote to ML/User | Module-Scoped Access |
|---|---|---|---|---|---|---|
| Organization Lead | Yes | Yes | Yes | Yes | Yes | Full |
| Event Promoter | Yes | Yes | No | No | Yes (ML and User only) | Full |
| Module Lead | No | No | No | No | No | Only assigned modules per event (full EP-level write access within those modules) |
| User (Member) | No | No | No | No | No | None — org association only |

- **Organization Lead (OL)** is the owner of the organization. Multiple OLs per org are allowed. Only OLs can access Organization Settings. OLs can edit all members.
- **Event Promoter (EP)** within an org has the same functional capabilities as a standalone EP, scoped to the org's events. EPs cannot edit OL or EP members. EPs can only change members to Module Lead or User.
- **Module Lead (ML)** functions as an EP for their assigned modules only. Full read-write access to assigned modules; no access to unassigned modules.
- **User (Member)** is associated to the organization but has no event management privileges. This level allows EP/OL to demote Module Leads while maintaining their org membership.

---

## 4. Relationship to Existing Role System

The platform role enum (`user`, `event_promoter`, `system_admin`) on `platform_users` remains the platform-level gate. Organization membership is a separate layer.

- When a user joins an org as OL, EP, or ML, their `platform_users.role` is auto-promoted to `event_promoter` (if currently `user`) so they pass the `/ep/*` middleware guard.
- A `promoted_via_org` flag on the membership record tracks whether the promotion was org-initiated, enabling safe cleanup if the user is later removed.
- **All Event Promoters belong to an organization.** There are no solo EPs post-implementation.
- Users may belong to multiple organizations simultaneously.
- A user's highest org access level across all their orgs determines their effective capabilities per-event.

---

## 4a. Active Organization Context

The platform maintains an **active organization** selection per user session, persisted via an `active_org` cookie. This selection:

- Is set via the **OrgSwitcher** dropdown on the **right side** of the top navigation bar (after notifications, before avatar)
- Includes a "No Organization" option so the user can view pages as a general user
- Informs all views: the EP Dashboard, event creation, venue management, and any other org-scoped page reads the active org from the cookie
- Cannot be changed from any other location on the platform — the nav bar is the single source of truth for session org switching
- The OrgSwitcher is only visible to users who are members of at least one organization
- Users with no org memberships see no org-related UI in the nav

**Default organization:** Each user may configure a default organization via `/profile/organization` (accessible from the avatar dropdown menu under "Organization"). The default org is stored as `platform_users.default_organization_id`. On login or when no cookie is set, the platform auto-selects the default org. If no default is set and the user has exactly one org, that org is auto-selected.

**Resolution order for active org:**
1. `active_org` cookie (explicit session selection from OrgSwitcher)
2. `default_organization_id` from `platform_users` profile
3. Auto-select if user has exactly one org
4. `null` — "No Organization" mode

**Role badge in AppNav:** The role badge on the left side of the nav shows the user's access level **for the selected organization**, not their platform role. When "No Organization" is selected, no role badge is shown (except for System Admins who always see "System Administrator"). For example, a user who is an EP in Org A but a Module Lead in Org B will see "Event Promoter" when Org A is selected and "Module Lead" when Org B is selected.

**Avatar dropdown menu:** Includes "Organization" link (only for users with org memberships) that navigates to `/profile/organization` where the user can set their default org and view all their memberships with "Manage organization" links. This is the single location for org membership management — the EP Dashboard does NOT show an org list.

**Page refresh on org change:** Changing the active organization triggers `window.location.reload()`, not `router.refresh()`. This ensures all server components re-execute with the new cookie value AND all client components re-initialize with fresh props (e.g., form fields, selected IDs). `router.refresh()` alone leaves client state stale, which would allow acting on a previously selected organization.

**Implementation:**
- `src/components/nav/OrgSwitcher.tsx` — client component on right side of nav, sets `active_org` cookie on change, triggers `window.location.reload()` for full page refresh (ensures all server AND client components re-initialize with new org context), includes "No Organization" option
- `src/components/nav/AvatarMenu.tsx` — includes "Organization" link when `hasOrgs` is true
- `src/lib/auth/org-context.ts` — `getOrgContext(userId, platformRole)` — reads org memberships + cookie + default org, returns `{ orgs, activeOrgId }`
- `src/app/(platform)/profile/organization/` — default org configuration page with membership list
- `platform_users.default_organization_id` — persisted default (migration `20260402000011`)
- All four layouts (platform, EP, admin, org) call `getOrgContext` and pass results to AppNav

---

## 5. Event Ownership

- `platform_events.organization_id` is **NOT NULL** — every event belongs to an organization.
- `owner_id` retains its meaning as the creating user (audit trail).
- Any org member with OL or EP access can manage any event in their org.
- Module Leads can manage only the modules they are assigned on a given event.

---

## 6. Venue Ownership

- `venues` gains a **NOT NULL** `organization_id UUID FK` column.
- Any OL or EP in the org can use any venue belonging to their organization.
- Venues are not shared across organizations.

---

## 7. Payment Provider

- Payment provider moves from `platform_users.payment_provider` to `organizations.payment_provider`.
- Set by the Organization Lead. Applies to all events created by the organization.
- The EP profile page payment settings section is replaced by org-level settings.
- At checkout, the platform reads the payment provider from the event's organization.

---

## 8. Notification Routing for Org Events

- **Default recipients:** The event creator (`owner_id`) AND any Module Lead assigned to the module associated with the notification type.
- Who receives which notifications is **configurable by an EP** (OL or EP access level) from the event's notification settings.
- Notification preferences are stored per-event, not per-org.

---

## 9. Organization Lifecycle

- **Creation:** During user registration (optional) or by Platform Administrator.
- **Archiving:** Organizations can be archived by OL or SA. Archived orgs maintain all existing events and data but prevent creation of new events. Events within archived orgs continue to function normally.
- **Deletion:** Not supported in MVP. Only archiving is available.

---

## 10. Member Invitation Flow

OLs can invite members in two ways:

1. **Search for existing platform user by email** — sends an org invitation notification. User accepts from their notifications page to join the org.
2. **Enter an email for a non-platform user** — sends a registration invitation email. The invitee registers on the platform, and on account activation, is automatically added to the org at the access level specified by the OL (EP or ML).

---

## 11. Database Schema

### New Tables

**`organization_tiers`**
```sql
CREATE TABLE organization_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,              -- 'free', 'pro', 'enterprise'
  billing_interval TEXT,                  -- 'monthly' | 'yearly' | null (free)
  price_cents INTEGER,                    -- null for free tier
  max_members INTEGER,                    -- null = unlimited
  max_events INTEGER,                     -- null = unlimited
  max_tickets_per_event INTEGER,          -- null = unlimited
  allowed_modules TEXT[],                 -- null = all modules; restricted subset for future paid tiers
  max_attendees_per_event INTEGER,        -- null = unlimited
  max_storage_mb INTEGER,                 -- null = unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`organizations`**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website TEXT,
  logo_url TEXT,
  social_media JSONB,                     -- [{ "key": string, "value": string }]
  payment_provider TEXT CHECK (payment_provider IN ('square', 'paypal')),
  tier_id UUID NOT NULL REFERENCES organization_tiers(id),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`organization_members`**
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('organization_lead', 'event_promoter', 'module_lead')),
  promoted_via_org BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
```

**`organization_module_access`** (Module Lead per-event, per-module grants)
```sql
CREATE TABLE organization_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_member_id, event_id, module_key)
);
```

**`organization_invitations`** (pending invitations)
```sql
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES platform_users(id),
  email TEXT NOT NULL,                     -- target email (may or may not have an account)
  access_level TEXT NOT NULL CHECK (access_level IN ('event_promoter', 'module_lead')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT UNIQUE,                       -- registration invitation token for non-platform users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
```

### Altered Tables

**`platform_events`** — `organization_id` becomes NOT NULL:
```sql
ALTER TABLE platform_events ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_platform_events_org_id ON platform_events(organization_id);
```

**`venues`** — add org scope:
```sql
ALTER TABLE venues ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_venues_org_id ON venues(organization_id);
```

> **Note:** `venues.owner_id` is retained as the creating user (audit trail). `organization_id` determines which org members can access the venue.

### Seed Data

```sql
-- Free tier: all limits null (unlimited for now)
INSERT INTO organization_tiers (name, billing_interval, price_cents, max_members, max_events, max_tickets_per_event, allowed_modules, max_attendees_per_event, max_storage_mb)
VALUES ('free', null, null, null, null, null, null, null, null);
```

---

## 12. Authorization Helper

A shared `checkEventAccess()` function replaces the current inline `owner_id = user.id` checks:

```typescript
// src/lib/auth/event-access.ts
async function checkEventAccess(
  userId: string,
  eventId: string,
  requiredLevel: 'owner' | 'org_ep' | 'module_lead',
  moduleKey?: string  // required when level = 'module_lead'
): Promise<{ authorized: boolean; event: PlatformEvent | null; orgMembership: OrganizationMember | null }>
```

Authorization cascade:
1. System Admin — always authorized
2. Direct ownership (`owner_id = userId`) — authorized for all levels
3. Org OL/EP membership — authorized for `owner` and `org_ep` levels
4. Module Lead + module access grant — authorized for `module_lead` level on the specific module

All existing EP Server Actions migrate to call this helper.

---

## 13. Route Structure

### New Routes

```
/org/[org-slug]/dashboard              -- org overview, events, member summary
/org/[org-slug]/members                -- member list, invite, change access ("Manage →" link per row)
/org/[org-slug]/members/[user-id]      -- member detail, module access config (IMPLEMENTED — see below)
/org/[org-slug]/settings               -- org name, website, social media, payment provider
/org/[org-slug]/events/new             -- create event scoped to org

/admin/organizations                   -- list all organizations
/admin/organizations/new               -- create org
/admin/organizations/[org-id]          -- org detail, OL assignment, tier, archive
```

**Implemented: `/org/[org-slug]/members/[user-id]`**

Server page: `src/app/(org)/org/[org-slug]/members/[user-id]/page.tsx`
Client component: `src/app/(org)/org/[org-slug]/members/[user-id]/MemberDetailClient.tsx`

- Displays member info: display name, email, access level badge
- **For Module Leads:** renders all org events, each with a checkbox list of that event's enabled modules (sourced from `module_config`). Only modules actually enabled on the event appear as options. A per-event Save button appears when unsaved changes are detected. Saving calls `updateMemberModuleAccess()`.
- **For non-ML members:** shows an informational message explaining that module access configuration applies to Module Leads only.
- Members list (`MembersClient.tsx`) was updated to include a "Manage →" link on each row.

**Server Action: `updateMemberModuleAccess(orgSlug, memberId, eventId, moduleKeys[])`**
Location: `src/app/(org)/org/[org-slug]/actions.ts`

- Validates caller has OL or EP access to the org
- Validates target member is a Module Lead
- Validates event belongs to the org
- Validates each requested module key is enabled on the event's `module_config`
- Replaces all existing `organization_module_access` grants for the member + event with the new set

### Modified Routes

- **Registration** — optional "Create an Organization" section with org name
- **EP Dashboard** — query based on org membership; "Organizations" section with links
- **EP Event pages** — authorization checks use `checkEventAccess` instead of `owner_id`
- **EP Venue pages** — filtered by org membership; venue creation sets `organization_id`
- **Profile page** — payment provider section removed (now org-level)
- **Attendee-facing event pages** — display org name and logo

---

## 14. Free-Tier Structure

The tier system is structured for future monetization. Currently, free tier has no restrictions. In the future, free tier will have the most restrictions and paid tiers will unlock more.

| Parameter | Free Tier (Now) | Free Tier (Future) | Paid Tiers (Future) |
|---|---|---|---|
| `billing_interval` | null | null | monthly / yearly |
| `price_cents` | null (free) | null (free) | e.g. 2999, 9999 |
| `max_members` | null (unlimited) | e.g. 3 | e.g. 25, 100, unlimited |
| `max_events` | null (unlimited) | e.g. 1 | e.g. 10, unlimited |
| `max_tickets_per_event` | null (unlimited) | e.g. 50 | e.g. 500, unlimited |
| `allowed_modules` | null (all) | e.g. ['ticketing'] | e.g. all |
| `max_attendees_per_event` | null (unlimited) | e.g. 50 | e.g. 500, unlimited |
| `max_storage_mb` | null (unlimited) | e.g. 100 | e.g. 1000, unlimited |

Tier enforcement is checked at creation/mutation boundaries (create event, add member, create ticket type). For the current free tier, all checks pass. Future tiers constrain by updating the tier row — no code changes needed.

---

## 15. Implementation Phases

### Phase 1: Database Foundation
- Migration files for all new tables + altered tables
- RLS policies for new tables and expanded policies for existing tables
- TypeScript types (`Organization`, `OrganizationTier`, `OrganizationMember`, `OrgAccessLevel`, etc.)
- `checkEventAccess` authorization helper
- Seed script: test org (free tier), test members at each access level

### Phase 2: Admin Org Management
- `/admin/organizations` list, create, detail pages
- Server actions for org CRUD, OL assignment, tier assignment, archiving
- Org detail: member list, tier display

### Phase 3: Registration Integration
- Optional "Create an Organization" on registration form
- Org creation in `registerDevUser` and auth callback
- Auto-promote to `event_promoter` on org creation

### Phase 4: Organization Dashboard & Member Management
- `(org)` route group with membership guard layout
- Dashboard: org events, member summary, org details
- Member management: invite (search existing user / send registration email), change access level, remove
- Module Lead access configuration per member per event ✓ *(implemented — see §13 for route details)*
- Org settings: name, website, logo, social media, payment provider

### Phase 5: EP Dashboard + Event Integration
- EP dashboard query based on org membership
- Event creation requires org context
- Refactor all EP Server Actions to `checkEventAccess`
- Venue management scoped to org
- Module-level gating for Module Leads in EP event management pages
- Attendee-facing pages show org branding

### Phase 6: Tier Enforcement (deferrable)
- Limit checks at creation boundaries
- Tier management admin UI
- Billing integration placeholder

---

## 16. Risks

- **Authorization refactor scope:** Every existing EP Server Action (estimated 30+) needs to migrate from `owner_id = user.id` to `checkEventAccess()`. This is a large refactor with regression risk. Mitigated by full DB reset before testing.
- **RLS complexity:** Org-aware RLS policies add JOIN conditions to every event-scoped query. Performance must be validated with realistic data.
- **Module Lead granularity:** The per-event, per-module access table could grow large for orgs with many events. Index strategy is critical.
- **Payment provider migration:** Moving from per-user to per-org requires updating all checkout and refund paths that currently read `platform_users.payment_provider`.

---

## 17. Resolved Product Decisions

All questions from the original draft have been answered:

1. **Multiple org membership:** Yes, users can belong to multiple organizations.
2. **Venues:** Organization-scoped. Any OL/EP in the org can use any org venue.
3. **Notifications:** Event creator + assigned ML by default. Configurable by EP.
4. **Org deletion:** Not supported. Archiving only — maintains all data, blocks new event creation.
5. **Member invitation:** Search existing user by email, or send registration invitation to non-platform users.
6. **Solo EP migration:** N/A — full DB reset. No solo EPs post-implementation.
7. **Event transfer:** N/A — all events belong to an org. No solo EP concept.
8. **Module Lead access:** Full EP-level write access within assigned modules.
9. **Payment provider:** Organization-wide, set by OL.
10. **Org branding:** Yes, org name and logo appear on attendee-facing event pages.
11. **Free tier:** NULL = no restrictions now. Future free tier will be the most restricted; paid tiers unlock more.
