# SD Platform — Technical Assessment
**Date:** 2026-03-31
**Scope:** Theming & Styling, Database Efficiency, Mobile / Cross-Platform

---

## Table of Contents

1. [Theming & Styling](#1-theming--styling)
2. [Database Efficiency](#2-database-efficiency)
3. [Mobile & Cross-Platform](#3-mobile--cross-platform)
4. [Priority Sequencing](#4-priority-sequencing)

---

## 1. Theming & Styling

**Difficulty: Moderate / Easy**

### What Is Already in Place

- **Design token system** — CSS variables defined in `src/app/globals.css` and mapped through `tailwind.config.js`:
  - `--sd-bg`, `--sd-card`, `--sd-border`, `--sd-text`
  - `--sd-green` (primary action), `--sd-purple` (EP brand), `--sd-red` (admin brand)
  - `--sd-amber`, `--sd-blue` with light/dark variants
  - Changing a brand color site-wide is a one-line edit in `globals.css`

- **Dark mode** — architecturally supported via Tailwind `class` strategy and CSS variable overrides in `globals.css` (lines 61–86). Not yet togglable at runtime — no `ThemeProvider` wired.

- **Fonts** — four fonts loaded via Next.js Google Fonts in `src/app/layout.tsx`:
  - **Inter** (primary)
  - **Open Sans** (body default)
  - **Montserrat** (available as `font-montserrat`)
  - **JetBrains Mono** (monospace)

- **Animation system** — `tailwindcss-animate` installed and configured in `tailwind.config.js` with keyframes for accordion, fade-in, slide-in (top/bottom), and scale-in. Not yet applied to page transitions or UI interactions.

- **Component library** — shadcn/ui configured in `components.json` (style: `new-york`, RSC-enabled, CSS variables, Lucide icons).

- **Token usage rate** — approximately 70–80% of color values use semantic tokens. The remaining ~20–30% are raw hex values (primarily grays such as `#F3F4F6`) scattered across dashboard pages.

### What Needs Work

| Gap | File(s) | Effort |
|---|---|---|
| Raw hex colors not yet tokenized | `src/app/(platform)/dashboard/page.tsx`, others | Low — sweep and replace |
| No runtime theme toggle | Requires adding `next-themes` `ThemeProvider` | Low |
| No logo integration | `src/components/nav/AppNav.tsx` | Low |
| `next/image` not used for platform images | Supabase Storage URLs served raw | Medium — add optimization pass |
| AppNav built with inline styles | `src/components/nav/AppNav.tsx` | Medium — refactor to Tailwind for responsive work |
| Animations not applied to UI | All page-level transitions | Medium — additive, no rearchitecting |

### Verdict

A meaningful visual overhaul is achievable in a focused sprint. Global brand changes are fast due to the token system. Per-component polish (animations, backgrounds, logo placement) is additive — nothing needs to be rearchitected.

---

## 2. Database Efficiency

**Difficulty: Moderate — specific fixes required before Registration**

### What Is Already Good

- Server actions use specific column selects (e.g., `.select('id, title, start_date, end_date, status, module_config')`) rather than `select('*')` in most places.
- Notifications are fire-and-forget (`void`) so they do not block server action responses.
- The Roommate Finder is a server-side RPC (`get_roommate_finder_cards`) that pre-aggregates all card data in a single database call — correct architecture.
- Batch queries are used in most places rather than per-row queries.

### Specific Issues Found

#### Zero caching
Every page load in every layout (platform, EP, admin) executes three database queries unconditionally:
1. `auth.getUser()` — session refresh
2. `platform_users` — role and display name
3. `platform_notifications` — unread count for the bell badge

The notification count query hits on every single navigation event across all three role contexts. This is the highest-priority caching target.

**Fix:** Wrap the notification count query in `unstable_cache` with a short TTL and tag-based invalidation on new notification inserts.

#### Non-atomic room selection lock
**File:** `src/app/(platform)/events/[event-id]/rooms/actions.ts` — `selectRoom` function

The current pattern is check-then-update:
```
1. Query: does this room already have a Room Lead?
2. If not → update: assign this user as Room Lead
```

There is a race condition window between steps 1 and 2. Two concurrent users can both pass the check and both be assigned as Room Lead for the same room.

**Fix:** Replace with a stored procedure that performs the check and update atomically inside a transaction, or use a `SELECT ... FOR UPDATE` advisory lock pattern.

**This must be resolved before Registration is built.** Event-day load will have many concurrent users.

#### O(n) profile lookup in rooms page
**File:** `src/app/(platform)/events/[event-id]/rooms/page.tsx` — line 120

Applicant profiles are fetched in a single batched query (correct), but the join to match profiles to applications uses `Array.find()` inside a loop — O(n²) in the worst case.

**Fix:** Convert to a `Map<userId, profile>` for O(1) lookup. Minor performance issue now; degrades as applicant count grows.

#### Roommate Finder RPC — index gap
**File:** `supabase/migrations/` — `get_roommate_finder_cards` RPC

The RPC uses a 6-way CTE join including a full scan of `event_attendees` filtered by `event_id`, `room_status`, and `room_id`. As attendee count grows, this will benefit from a composite index.

**Fix:** Add index on `event_attendees(event_id, room_status, room_id)` — monitor query execution time with 500+ attendees.

### Summary Table

| Issue | Location | Severity | Fix Size |
|---|---|---|---|
| No caching on notification count | All layout files | High | Small |
| Non-atomic room lock | `rooms/actions.ts` | High (pre-Registration) | Medium |
| O(n) profile lookup | `rooms/page.tsx:120` | Low (now), Medium (at scale) | Small |
| Missing composite index on event_attendees | Migration | Low (now), Medium (at scale) | Small |

### Connection Pooling

No explicit pooling configuration detected. Supabase SSR client uses default connection management. For production at 1,000+ concurrent users, enable PgBouncer in the Supabase project settings.

### Verdict

Normal load (< 200 concurrent users) will function acceptably as-is. Before Registration goes live — which will create concentrated concurrent DB activity at event check-in — the atomic room lock and notification caching must be addressed. The other items are low effort and should be done opportunistically.

---

## 3. Mobile & Cross-Platform

**Difficulty: Hard for native app. Low-Medium for PWA.**

### Current State

**No mobile optimization is in place:**

- No PWA configuration (`manifest.json`, service worker, `next-pwa`)
- AppNav does not have a hamburger menu or responsive breakpoints — overflows on screens narrower than ~640px
- No touch event handlers, swipe gestures, or mobile-specific interaction patterns
- `next/image` is not used in the platform — images served as raw Supabase Storage URLs
- No Web App meta tags in root layout

### Web-Only Features That Block a Native App

| Feature | Implementation | Native Blocker |
|---|---|---|
| PDF generation | Puppeteer (headless Chrome, server-side) | Stays server-side; not a UI blocker but requires server connection |
| File uploads / image crop | React Advanced Cropper → Supabase Storage | Needs native file picker bridge |
| Square payment SDK | Square Web Payments SDK (browser JS) | Square has a separate native SDK; requires different integration |
| Auth session management | Next.js middleware, cookie-based | Middleware is Next.js-specific; incompatible with native routing |

### Options in Order of Effort

#### Option A — PWA (Progressive Web App)
**Effort: Low-Medium (1–2 sprints)**

Adds installability to the existing web app. Users can add it to their home screen from the browser. No App Store listing without additional tooling, but works on both iOS and Android.

What this involves:
- Add `next-pwa` plugin
- Create `public/manifest.json` with icons and theme color
- Fix AppNav for mobile (hamburger menu on < 640px)
- Add Web App meta tags to root layout
- Optional: add offline fallback page for poor event-venue connectivity

This is the recommended first step. It addresses the real use-case (attendees on phones at events) with minimal risk.

#### Option B — WebView Wrapper (Capacitor or Expo Web)
**Effort: Medium (several sprints)**

Packages the web app inside a native shell for App Store / Play Store distribution. The app is still a web app — it runs in a WebView — but it ships as a native binary.

Main work items:
- Capacitor or Expo Web setup and native project configuration
- Bridge layer for auth (cookies → native storage)
- Bridge layer for file picker (native camera/gallery → existing upload flow)
- Square native SDK integration to replace Web Payments SDK
- App Store / Play Store developer account setup and submission process

This is viable but adds ongoing native maintenance overhead.

#### Option C — True React Native
**Effort: Very High (months)**

Full rewrite of all UI in React Native components. Business logic and API calls can be shared; nothing visual carries over. Only warranted if native performance and App Store presence are primary product requirements — not recommended until the web platform is feature-complete and stable.

### Verdict

**Recommended path:** Build the PWA first. It directly addresses the primary mobile use case (attendees checking their room, schedule, and status at an event on their phone) with low effort and no new codebase. The navigation fix (hamburger menu) is needed regardless of PWA plans — the app currently overflows on phones.

A true App Store app is a post-platform-completion goal. Capacitor is the right bridge when that time comes, not React Native.

---

## 4. Priority Sequencing

In recommended order:

| Priority | Item | Why Now |
|---|---|---|
| 1 | Fix atomic room lock (`rooms/actions.ts`) | Real race condition under concurrent load; must precede Registration |
| 2 | Mobile navigation (AppNav hamburger) | Currently broken on phones; affects usability today |
| 3 | Theming sprint | High visibility, good momentum; token system makes it tractable |
| 4 | PWA setup | Gets app on home screens cheaply; low risk |
| 5 | Notification count caching | Performance; address before Registration traffic spike |
| 6 | App Store (Capacitor wrapper) | After platform is feature-complete and stable |
