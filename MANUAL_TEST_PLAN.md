# SD Platform — Manual Test Plan

**Test environment:** Local dev or staging
**Seed data:** Run `npm run seed` before starting
**Seed accounts:** `user1–user5@test.local` / `User1234!`, `promoter@test.local` / `Promo1234!`, `admin@test.local` / `Admin1234!`

---

## 1. Authentication

### 1.1 Registration
- [ ] Register with a valid email, password, DOB (30 years ago), and scene name → verify email verification screen appears
- [ ] Click the verification link → verify redirect to dashboard
- [ ] Attempt registration with DOB under 21 → verify rejection error is displayed, no account created
- [ ] Attempt registration with an email already in use → verify appropriate error
- [ ] Attempt registration without filling required fields → verify client-side validation fires before submit
- [ ] Register, do NOT verify email → attempt to log in → verify login is blocked with a "verify your email" message (or verify the session is not granted)
- [ ] **UI check:** Registration form is readable on mobile (375px width)

### 1.2 Login
- [ ] Login with valid credentials → verify redirect to `/dashboard`
- [ ] Login with wrong password → verify error message, no redirect
- [ ] Login with unrecognized email → verify generic error (not "user doesn't exist" — no user enumeration)
- [ ] Use "Forgot Password" → verify reset email arrives and link works
- [ ] After password reset → verify old password no longer works, new password does

### 1.3 Session
- [ ] Log in → manually navigate to `/dashboard` as a logged-out user → verify redirect to login
- [ ] Log in as user → manually type `/admin/dashboard` → verify access denied (redirect or 403, not the admin page)
- [ ] Log in as user → manually type `/ep/dashboard` → verify access denied
- [ ] Log out → verify session is cleared, redirect to login

---

## 2. User Profile

- [ ] Navigate to `/profile` → verify all fields present (scene name, email, DOB, Telegram handle, social media, profile picture)
- [ ] Update preferred scene name → save → verify the new name appears in the platform nav and any visible display contexts
- [ ] Upload a profile picture → verify it saves and displays
- [ ] Add a social media link → save → verify it persists on page reload
- [ ] Toggle "Hide my name in Roommate Finder" → save → later verify your name shows as "Anonymous" in the room grid (requires room selection section below)
- [ ] Enter a Telegram handle with `@` prefix → save → verify `@` is stripped and only the handle is stored
- [ ] **Email change:** Enter a new email address → verify a verification email is sent to the *new* address → confirm it → verify you are logged out and must log in with the new email → verify old email no longer works
- [ ] **UI check:** Profile page layout does not overflow on mobile

---

## 3. Event Discovery & Enrollment Gating

- [ ] As a user with no attendee record, navigate to the Full Test Event URL → verify Event Detail View is shown (not the attendee hub) — title, dates, location, description visible
- [ ] Verify the correct CTA appears: "Apply now →" if Application module is open, "Get your ticket →" if only Ticketing is open, or "Stay tuned" if neither is open
- [ ] As a logged-out user, navigate to the event URL → verify redirect to login
- [ ] After login, confirm redirect returns to the event page (not just the dashboard)
- [ ] Attempt to access `/events/[event-id]/rooms` directly without being enrolled → verify redirect to the event hub page, not a blank page or 500 error

---

## 4. Application Module

- [ ] As `user1`, navigate to the Full Test Event → click "Apply now" → verify the application form loads with all configured fields
- [ ] Fill in part of the form and navigate away without submitting → return to the form → verify it is empty (no draft saved — per spec, drafts are not persisted until submission)
- [ ] Submit the complete form → verify:
  - Success confirmation displayed
  - Redirect or update to the event hub
  - Attendee record now exists (hub shows enrolled view, not detail view)
  - Application status shows "Needs Review" or "Completed"
- [ ] Navigate back to the application form → verify it is pre-populated with your submitted answers
- [ ] Edit an answer and re-submit → verify the update is reflected
- [ ] **As EP** (`promoter@test.local`): navigate to EP panel → Full Test Event → Attendees → find `user1` → verify the application is visible with all responses
- [ ] **As EP:** Change `user1`'s application status to "Approved" → verify `user1` can now access the ticket purchase step
- [ ] **As EP:** Change status from "Approved" back to "Declined" while `user1` has no ticket → verify it goes through without a modal
- [ ] Re-approve `user1` so they can purchase a ticket

---

## 5. Ticketing Module

### 5.1 Basic Purchase (Square)

*Prerequisite: EP's payment provider is set to Square*

- [ ] As `user1` (approved application), navigate to the ticket step → verify correct ticket types are listed with prices
- [ ] Select "Room Lead Pass" → advance through checkout steps → verify the Roommate Code step does **not** appear (user is the Room Lead, not a roommate)
- [ ] Verify volunteer shift selection step appears (if ticket has `volunteer_hours_required > 0`)
- [ ] Verify merchandise step appears with correct items; verify "VIP Lanyard" appears for Room Lead Pass; verify "VIP Lanyard" does **not** appear for Roommate Pass
- [ ] Reach the payment step → enter Square test card `4111 1111 1111 1111`, any future expiry, any CVV → complete purchase
- [ ] Verify:
  - Purchase confirmation page shows Roommate Code (since `roommate_codes_enabled = true` on Room Lead Pass)
  - Event hub updates: Ticket status shows "Complete"
  - EP panel shows `user1`'s ticket as complete
  - `orders` table has a record with `status = 'complete'`
- [ ] **UI check:** Card form renders correctly, no layout overflow on the payment step

### 5.2 Basic Purchase (PayPal)

- [ ] As EP, change payment provider to PayPal in `/profile` payment settings → save
- [ ] As `user2`, complete a Roommate Pass purchase using the PayPal button flow (sandbox)
- [ ] Verify the PayPal modal opens, complete sandbox login, approve → verify redirect back and order completion
- [ ] Switch EP back to Square afterward

### 5.3 $0 Order

- [ ] Set a ticket type to $0 (or verify seed has one) → complete checkout → verify the payment step is skipped entirely, "Confirm Purchase" completes the order with no card form shown

### 5.4 Duplicate Ticket Prevention

- [ ] As `user1` (already has a ticket), attempt to navigate to the ticket purchase page → verify an error or redirect prevents purchasing a second ticket

### 5.5 Self-Cancel

- [ ] As `user2` (has a ticket, event not locked), navigate to the ticket status card → click "Cancel ticket"
- [ ] Verify the cancellation policy is displayed (refund percentage based on current event status)
- [ ] Confirm cancellation → verify:
  - Ticket status reverts to "Incomplete"
  - Order status updates to "refunded" or "cancelled"
  - If a refund applies, verify `amount_refunded` is set correctly on the order

---

## 6. Room Selection — Room Lead Flow

*Prerequisite: `user1` has a Room Lead ticket and an approved application*

- [ ] Navigate to the Room Selection module → verify the room grid loads
- [ ] Verify blocked rooms (seeded: "Staff" and "Playroom") do not appear in the grid
- [ ] Verify each card shows: room name, room number, lodging type, open spot count, per-night pricing, occupant slots
- [ ] Click a room → verify a detail view or confirmation card appears with room info
- [ ] Confirm selection → verify:
  - Room is now marked as taken in the grid (no longer shows "OPEN" for the Room Lead slot)
  - Event hub shows room number and type
  - `event_attendees.room_id` is set, `room_status = 'Selected'`
- [ ] Try to select a different room → verify you can change your selection before lock-in
- [ ] **UI check:** Room grid is usable on a tablet-width screen (768px); cards do not overflow

---

## 7. Room Selection — Roommate Flow

*Prerequisite: `user1` has a room selected; `user2` has a Roommate Pass*

- [ ] As `user2`, access the Roommate Finder → verify `user1`'s room is visible with correct open spot count
- [ ] Apply for a spot in `user1`'s room → verify success message
- [ ] As `user1`, check notifications → verify row 7 notification appeared (in-platform bell, notifications page)
- [ ] As `user1`, navigate to the room detail / applicant management → accept `user2`'s application
- [ ] As `user2`, verify:
  - Notification received (row 8 — in-platform)
  - Event hub shows the room assignment
  - Room grid card for that room shows one fewer open spot
- [ ] As `user3`, apply for the **same** bed spot that `user2` was accepted for → then as `user1`, accept another application for that spot
  - Verify `user3` receives a "declined" notification (row 9 — superseded)
- [ ] **Privacy test:** Toggle "Hide my name in Roommate Finder" on `user2`'s profile → verify `user2`'s name shows as "Anonymous" in the grid, not their scene name

---

## 8. Roommate Codes

*Prerequisite: `user1` has a Room Lead ticket with `roommate_codes_enabled = true`, and has already selected a room*

- [ ] Confirm `user1`'s Roommate Code is visible on:
  - [ ] The checkout success screen (check during purchase if re-purchasing from a fresh seed)
  - [ ] The ticket status card on the event hub
- [ ] As `user3` (Roommate Pass), begin ticket checkout → verify the Roommate Code step appears between ticket selection and volunteer shifts
- [ ] Enter an invalid code → verify inline error: "This code is not valid."
- [ ] Enter the pre-seeded code `TESTRL` (user1's code) while user1 has no room yet (reset user1's room first) → verify error: "Your Room Lead has not selected a room yet."
- [ ] Re-select user1's room → as `user3`, enter `TESTRL` → verify the confirmation card shows user1's room details (name, number, Room Lead display name, per-night pricing)
- [ ] Click "Use a different code / skip" → verify you return to the code input step
- [ ] Re-enter the code and confirm → complete checkout → verify:
  - `user3.room_id` is set, `room_status = 'Selected'`
  - Room grid shows one fewer open spot
  - `user1` receives notification row 32 (in-platform)
- [ ] Fill all remaining spots in `user1`'s room → have a 5th user attempt to use the code → verify "This room is currently full" error
- [ ] Verify `user1` received notification row 33 (room full attempt)
- [ ] **Skip flow:** As `user4`, begin checkout → skip the code step → verify checkout completes with no room assignment

---

## 9. Room Lead — Claim by Email

*Prerequisite: `user1` has a room selected and a Room Lead ticket*

- [ ] As `user1`, navigate to the room detail page → find "Find a Roommate" panel → enter an email address of a user who does **not** have a ticket (prerequisite not met) → verify error: "This user has not completed the required steps..."
- [ ] Enter `user5@test.local` (has a ticket) → verify the claim is sent and `user5` receives notification row 29 (in-platform)
- [ ] As `user5`, navigate to the notifications page or the portal → accept the invitation
- [ ] Verify `user5` is placed in `user1`'s room
- [ ] As `user1`, verify notification row 30 received (in-platform)
- [ ] Repeat with another user and decline the invitation → verify `user1` receives notification row 31

---

## 10. Volunteer Module

*Prerequisite: A ticket type with `volunteer_hours_required = 4` is used; `user4` has this ticket*

- [ ] As `user4`, navigate to the Volunteer module → verify the shift list is shown in chronological order with shift names, dates, times, capacity, and remaining spots
- [ ] Sign up for a shift → verify the hours countdown updates ("1 of 4 required hours selected")
- [ ] Attempt to sign up for the **same shift twice** → verify rejection
- [ ] Attempt to sign up for an **overlapping shift** → verify rejection with an appropriate message
- [ ] Sign up for enough shifts to meet the hours requirement → verify the module shows as complete
- [ ] Remove a shift signup → verify the hours countdown decreases
- [ ] **As EP:** navigate to the volunteer management page → verify all signups are visible; add the "Area Lead" label to one signup → verify it displays but does not change any permissions

---

## 11. Schedule Module

- [ ] As a logged-in user enrolled in the event, navigate to the Schedule module → verify activities are listed in chronological order
- [ ] Verify each activity shows: name, date/time, duration, description
- [ ] As a non-enrolled user navigating to the event URL → verify the Schedule is still visible inline on the Event Detail View
- [ ] **As EP:** Navigate to schedule management → add a new activity (all required fields) → verify it appears in the attendee view
- [ ] **As EP:** Test CSV import → download the template → fill in valid rows → upload → verify activities appear
- [ ] Upload a CSV with one invalid row (e.g., missing Description) → verify only that row is skipped; valid rows are imported; an error report is shown

---

## 12. EP Panel

### 12.1 Event Management
- [ ] Log in as EP → verify the dashboard shows the two seeded events and any notifications
- [ ] Open the Full Test Event settings → edit the event title → save → verify the change is reflected on the EP dashboard and attendee-facing event hub
- [ ] Transition the event to a custom workflow status → verify the correct modules open automatically (per `opens_at_status` config)
- [ ] Manually close a module that is currently open → verify attendees cannot access it
- [ ] Re-open it → verify access is restored

### 12.2 Room Blocking
- [ ] Navigate to EP → event → rooms → block an unblocked room with a note ("Testing") → verify the room immediately disappears from the Roommate Finder for attendees
- [ ] Verify the blocked room is still visible in the EP's own room view, marked as blocked with the note
- [ ] Unblock it → verify it reappears in the Roommate Finder

### 12.3 Bed Blocking
- [ ] Block individual bed #1 of a 3-bed room → verify the Roommate Finder card shows 2 open spots instead of 3
- [ ] Assign a user to bed #1 → verify blocked-bed warning prompt appears and requires confirmation

### 12.4 Manual User-to-Room Assignment
- [ ] As EP, manually assign `user4` to a room they are not in → verify the four warning checks fire correctly (exceeds capacity, user already has room, blocked/reserved, prerequisites not met) — trigger each condition at least once
- [ ] Confirm one assignment through the warning → verify `user4.room_id` is updated

### 12.5 Attendee Status Management
- [ ] Change an attendee's `application_status` from "Approved" to "Declined" while they **have** a ticket → verify the two-option modal appears ("Cancel ticket and refund" vs. "Block portal access only")
- [ ] Choose "Block portal access only" → verify the attendee cannot access Room Selection or other gated modules, but their ticket record is intact
- [ ] Choose "Cancel ticket and initiate refund" on a different attendee → verify the order status becomes "refunded" and the ticket status resets to "Incomplete"

### 12.6 Lock Flow
- [ ] As `user1` (all required modules complete), click "Signal Ready to Lock" → verify EP receives notification row 10 (in-platform)
- [ ] As EP, lock `user1` → verify `user1`'s lock status is "Locked"
- [ ] As `user1`, attempt to change room selection → verify it is blocked
- [ ] As `user1`, attempt to re-submit the application → verify it is blocked

---

## 13. Admin Panel

- [ ] Log in as `admin@test.local` → navigate to `/admin/dashboard` → verify stat cards (total users, total events) are visible
- [ ] Navigate to `/admin/users` → verify all seeded users appear; columns show Display Name, Email, Role badge, Joined date
- [ ] Click "Manage →" for `user1` → verify the detail page shows profile fields (read-only), Role Management section, and no Payment Provider section (user is not EP/admin)
- [ ] Click "Manage →" for `promoter@test.local` → verify the Payment Provider (Square/PayPal) radio buttons appear
- [ ] Change the EP's payment provider to PayPal → save → reload the page → verify it persisted
- [ ] Promote a regular user to Event Promoter → verify the role badge updates and the user now has access to `/ep/dashboard`
- [ ] Attempt to demote yourself (the admin account) → verify the self-modification is blocked (read-only label, no button)
- [ ] As a newly promoted EP, log in → verify EP dashboard is accessible and the admin panel is not
- [ ] Demote the test EP back to User after testing

---

## 14. Notification Center

- [ ] Trigger any in-platform notification (e.g., submit an application, signal ready to lock, accept a room application)
- [ ] Navigate to `/notifications` → verify the notification appears with the correct title, body, event title, and action button
- [ ] Verify the AppNav bell shows a red unread count badge
- [ ] Open `/notifications` → verify all shown notifications are marked as read and the badge disappears
- [ ] Click an action button on a notification (e.g., "View Event Hub") → verify it navigates to the correct page
- [ ] Dismiss a notification → verify it disappears from the inbox
- [ ] Dismiss all → verify inbox is empty
- [ ] **EP:** Receive a notification for an application submission → verify the body includes the applicant's name and event title (not just a generic message)

---

## 15. Permission Boundary Checks (Security)

These tests verify that users cannot access data they are not authorized to see.

- [ ] As `user2`, manually type the URL for `user1`'s profile page (if one exists) → verify only Roommate Finder card data is available; no email, phone, DOB, or application responses visible
- [ ] As `user2`, call `GET /api/events` in the browser → verify the response contains no PII (no owner email, no attendee data)
- [ ] As a logged-out user, call `GET /api/events` → verify 401 or empty response
- [ ] As `user1`, manually type `/ep/events/[event-id]/attendees` → verify 403 or redirect, not the EP attendee list
- [ ] As `user1`, manually type `/admin/users` → verify 403 or redirect, not the user list
- [ ] As EP, manually type `/admin/users` → verify 403 or redirect (EP cannot access admin panel)
- [ ] As `user2`, attempt to access `user3`'s event attendee data via a direct Supabase API call using the anon key → verify RLS blocks it (returns 0 rows or 403)
- [ ] Verify that the `/api/test` and `/api/test-db` routes now return 404 (deleted in the security fix)
- [ ] Navigate to `/test-telegram` → verify 404 (page deleted)

---

## 16. Edge Cases & Error States

- [ ] **Expired lock:** Start a ticket checkout → wait 15+ minutes without completing → attempt to complete purchase → verify the lock has expired and an appropriate error is shown
- [ ] **Race condition (manual sim):** Open the same ticket purchase in two browser tabs simultaneously → complete purchase in one tab → attempt to complete in the second tab → verify the second is blocked (ticket unavailable or lock conflict)
- [ ] **Network error on payment:** Start Square checkout → disconnect from the network → attempt to submit → verify a graceful error message (not a blank screen or unhandled exception)
- [ ] **Empty states:** Navigate to the Roommate Finder before any rooms are added → verify a helpful empty state message, not a broken grid
- [ ] **Long content:** Enter a 40-character badge name (max allowed) → verify it renders without overflow in all contexts (event hub, EP panel, notifications)
- [ ] **Special characters:** Enter a scene name with apostrophes, ampersands, and emoji → verify it saves and renders correctly without SQL or XSS issues
- [ ] **Back button navigation:** Complete ticket purchase → click browser back → verify you land on the event hub, not the checkout form with the order re-submittable
- [ ] **Double-click submit:** On any form, double-click the submit button rapidly → verify only one submission is processed (no duplicate orders or applications)

---

## 17. UI/UX Checks

Run these at the end across all major screens.

- [ ] **Mobile (375px):** Registration, Login, Dashboard, Event Hub, Ticket Checkout, Room Grid, Notifications, Profile — nothing overflows or clips
- [ ] **Tablet (768px):** EP Dashboard, EP Attendee List, Room Grid — layout is usable
- [ ] **Loading states:** All async operations (form submit, payment processing, room application) show a loading indicator; no buttons remain clickable during in-flight requests
- [ ] **Error messages:** All error states show a human-readable message. No raw JSON, stack traces, or "Internal server error" visible to the user
- [ ] **Empty fields:** Anywhere a `preferred_scene_name` is null, verify the email-before-`@` fallback is used (not a blank or "null")
- [ ] **Navigation:** AppNav links all resolve to real pages; no broken hrefs or dead-end routes
- [ ] **Page titles:** Each page has a meaningful browser tab title (not just "SD Platform" everywhere)
- [ ] **Form validation:** Required fields on all forms show validation errors before allowing submission; errors are clearly associated with the specific field

---

## Quick Reference: Which Users to Use for What

| Test scenario | User to use |
|---|---|
| Full Room Lead flow (application → ticket → room → lock) | `user1` |
| Roommate apply flow | `user2` |
| Roommate code entry flow | `user3` |
| Volunteer hours flow | `user4` |
| New user (no enrollments) | `user5` |
| EP panel, room blocking, attendee management | `promoter@test.local` |
| Admin panel, role promotion | `admin@test.local` |
