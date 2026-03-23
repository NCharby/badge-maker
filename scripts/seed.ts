/**
 * SD Platform — Development Seed Script
 *
 * Run: npm run seed
 *
 * WARNING: Development and staging environments ONLY.
 * NEVER run against the production database.
 *
 * Phase 1 — Badge-maker tables (runs immediately; these tables exist in production schema)
 * Phase 2 — Platform tables (stubs; run platform migrations first)
 *
 * Seed accounts:
 *   admin@test.local     / Admin1234!  — System Administrator
 *   promoter@test.local  / Promo1234!  — Event Promoter
 *   user1@test.local     / User1234!   — Room Lead (ticket + completed order)
 *   user2@test.local     / User1234!   — Roommate (ticket + completed order)
 *   user3@test.local     / User1234!   — Roommate, roommate_finder_hidden=true
 *   user4@test.local     / User1234!   — Volunteer ticket holder
 *   user5@test.local     / User1234!   — No ticket yet
 */

import { createClient } from '@supabase/supabase-js'

// ── Validate environment ─────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Copy .env.example to .env.local and populate the Supabase variables.')
  process.exit(1)
}

// ── Supabase admin client ─────────────────────────────────────────────────────
// Service role key is required for auth.admin.createUser()
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a date string (YYYY-MM-DD) representing exactly 30 years before today. */
function dobThirtyYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 30)
  return d.toISOString().split('T')[0]
}

function section(label: string) {
  console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`)
}
function ok(msg: string) { console.log(`  ✓ ${msg}`) }
function warn(msg: string) { console.log(`  ⚠ ${msg}`) }
function fail(msg: string, err?: unknown): never {
  console.error(`  ✗ ${msg}`)
  if (err) console.error(err)
  process.exit(1)
}

const dob = dobThirtyYearsAgo()

const ACCOUNTS = [
  { email: 'admin@test.local',    password: 'Admin1234!', label: 'System Administrator' },
  { email: 'promoter@test.local', password: 'Promo1234!', label: 'Event Promoter' },
  { email: 'user1@test.local',    password: 'User1234!',  label: 'User — Room Lead' },
  { email: 'user2@test.local',    password: 'User1234!',  label: 'User — Roommate' },
  { email: 'user3@test.local',    password: 'User1234!',  label: 'User — Roommate (hidden)' },
  { email: 'user4@test.local',    password: 'User1234!',  label: 'User — Volunteer ticket' },
  { email: 'user5@test.local',    password: 'User1234!',  label: 'User — No ticket yet' },
] as const

// ── Phase 1: Badge-maker tables ───────────────────────────────────────────────
// These tables exist in the current production schema (supabase/schema.sql).
// This phase is safe to run immediately against any environment with the
// badge-maker schema applied.

async function seedBadgeMakerTables() {
  section('Phase 1: Badge-Maker Tables')

  // ── Template ────────────────────────────────────────────────────────────────
  console.log('\n  Templates...')
  const { error: templateError } = await supabase.from('templates').upsert(
    {
      id: 'badge-maker-default',
      name: 'Badge Maker Default',
      description: 'Default badge template',
      config: {
        dimensions: { width: 3.5, height: 2.25 },
        layout: {
          imagePosition: { x: 0.25, y: 0.5, width: 0.4, height: 0.4, aspectRatio: 1 },
          textPositions: {
            badge_name:   { x: 0.7, y: 0.3, width: 0.25, align: 'left' },
            email:        { x: 0.7, y: 0.5, width: 0.25, align: 'left' },
            social_media: { x: 0.7, y: 0.7, width: 0.25, align: 'left' },
          },
          fonts:  { badge_name: 'Inter', email: 'Inter', social_media: 'Inter' },
          colors: { background: '#ffffff', text: '#1f2937', accent: '#3b82f6' },
        },
        imageRequirements: { aspectRatio: 1, minWidth: 300, minHeight: 300, format: 'square' },
      },
      is_active: true,
    },
    { onConflict: 'id' }
  )
  if (templateError) fail('Failed to upsert default template', templateError)
  ok('Default template upserted')

  // ── Badge-maker events ───────────────────────────────────────────────────────
  // Note: This is the badge-maker `events` table — NOT platform_events.
  // The platform_events table will be created in a future migration.
  console.log('\n  Badge-maker events...')
  for (const event of [
    {
      slug: 'test-full-event',
      name: 'Full Test Event',
      description: 'All modules enabled (badge-maker entry)',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      is_active: true,
      template_id: 'badge-maker-default',
    },
    {
      slug: 'test-minimal-event',
      name: 'Minimal Test Event',
      description: 'Ticketing only (badge-maker entry)',
      start_date: '2026-11-01',
      end_date: '2026-11-03',
      is_active: true,
      template_id: 'badge-maker-default',
    },
  ]) {
    const { error } = await supabase.from('events').upsert(event, { onConflict: 'slug' })
    if (error) fail(`Failed to upsert badge-maker event: ${event.slug}`, error)
    ok(`Badge-maker event: ${event.slug}`)
  }

  // ── Auth accounts ────────────────────────────────────────────────────────────
  console.log('\n  Auth accounts...')
  const authUserIds: Record<string, string> = {}

  for (const account of ACCOUNTS) {
    const { data: existing } = await supabase.auth.admin.listUsers()
    const found = existing?.users?.find(u => u.email === account.email)

    if (found) {
      warn(`Already exists, skipping: ${account.email}`)
      authUserIds[account.email] = found.id
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // bypass email verification in dev
    })

    if (error) {
      warn(`Could not create ${account.email}: ${error.message}`)
      continue
    }
    authUserIds[account.email] = data.user.id
    ok(`Created: ${account.email} (${account.label})`)
  }

  ok('Phase 1 complete.')
  return authUserIds
}

// ── Phase 2: Platform tables (stubs) ─────────────────────────────────────────
// These tables do NOT exist yet — they are created by future migration files
// in supabase/migrations/. This phase is intentionally stubbed.
//
// As each migration is applied (supabase db push), uncomment the corresponding
// TODO block and fill in the actual insert/upsert logic.
//
// The try/catch block detects missing tables and exits gracefully.

async function seedPlatformTables(authUserIds: Record<string, string>) {
  section('Phase 2: Platform Tables (requires platform migrations)')

  // Suppress unused variable warning until TODOs are uncommented
  void authUserIds

  try {
    // Test whether platform_users table exists
    const { error: tableCheckError } = await supabase
      .from('platform_users')
      .select('id')
      .limit(1)

    if (tableCheckError) {
      warn('Platform tables not yet available.')
      warn('Apply platform migrations first:')
      warn('  supabase db push  (after creating migration files in supabase/migrations/)')
      warn('Skipping Phase 2.')
      return
    }

    // ── TODO: platform_users ──────────────────────────────────────────────────
    // Roles:
    //   admin@test.local    → role='system_admin'
    //   promoter@test.local → role='event_promoter', payment_provider='square'
    //   user1–5             → role='user'
    // All users: date_of_birth=dob (30 years ago), roommate_finder_hidden=false
    // user3: roommate_finder_hidden=true
    //
    // Uncomment when migration 20260101000000_create_platform_users.sql is applied:
    //
    // const platformUsers = [
    //   { id: authUserIds['admin@test.local'],    role: 'system_admin',   email: 'admin@test.local',    date_of_birth: dob, preferred_scene_name: 'Admin',     roommate_finder_hidden: false },
    //   { id: authUserIds['promoter@test.local'], role: 'event_promoter', email: 'promoter@test.local', date_of_birth: dob, preferred_scene_name: 'Promoter',  roommate_finder_hidden: false, payment_provider: 'square' },
    //   { id: authUserIds['user1@test.local'],    role: 'user',           email: 'user1@test.local',    date_of_birth: dob, preferred_scene_name: 'RoomLead1', roommate_finder_hidden: false },
    //   { id: authUserIds['user2@test.local'],    role: 'user',           email: 'user2@test.local',    date_of_birth: dob, preferred_scene_name: 'Roommate2', roommate_finder_hidden: false },
    //   { id: authUserIds['user3@test.local'],    role: 'user',           email: 'user3@test.local',    date_of_birth: dob, preferred_scene_name: 'Hidden3',   roommate_finder_hidden: true  },
    //   { id: authUserIds['user4@test.local'],    role: 'user',           email: 'user4@test.local',    date_of_birth: dob, preferred_scene_name: 'Volunteer4',roommate_finder_hidden: false },
    //   { id: authUserIds['user5@test.local'],    role: 'user',           email: 'user5@test.local',    date_of_birth: dob, preferred_scene_name: 'NoTicket5', roommate_finder_hidden: false },
    // ]
    // for (const u of platformUsers) {
    //   const { error } = await supabase.from('platform_users').upsert(u, { onConflict: 'id' })
    //   if (error) warn(`platform_users upsert failed for ${u.email}: ${error.message}`)
    //   else ok(`platform_user: ${u.email} (${u.role})`)
    // }
    warn('TODO: platform_users — uncomment after migration 20260101000000')

    // ── TODO: venues ──────────────────────────────────────────────────────────
    // Seed venue: "Test Venue"
    // owner_id = authUserIds['promoter@test.local']
    // Uncomment when migration 20260101000001_create_venues.sql is applied.
    warn('TODO: venues — uncomment after migration 20260101000001')

    // ── TODO: rooms ───────────────────────────────────────────────────────────
    // 10 rooms under Test Venue:
    //   King Studio x3:   bed_spot_count=2, min_occupancy=1
    //   Queen Double x4:  bed_spot_count=2, min_occupancy=2
    //   Bunk Room x3:     bed_spot_count=4, min_occupancy=2
    // room_daily_rates: 3 nights with different rates per night (Thu, Fri, Sat)
    // 2 rooms pre-blocked via event_room_config:
    //   King Studio #1 → block_note="Staff"
    //   King Studio #2 → block_note="Playroom"
    // Uncomment when migration 20260101000002_create_rooms.sql is applied.
    warn('TODO: rooms — uncomment after migration 20260101000002')

    // ── TODO: platform_events ─────────────────────────────────────────────────
    // Full Test Event:
    //   workflow_statuses: [Applications Open, Applications Closed, Tickets Open, Tickets Closed, Rooms Open, Rooms Closed]
    //   status: "Tickets Open"
    //   module_config: all modules; application+ticketing required, others optional
    //   cancellation_policy: {Applications Open UUID → 100%, Tickets Open UUID → 50%}
    //
    // Minimal Test Event:
    //   status: "Tickets Open"
    //   module_config: ticketing only; 1 ticket type at $0
    //
    // Uncomment when migration 20260101000003_create_platform_events.sql is applied.
    warn('TODO: platform_events — uncomment after migration 20260101000003')

    // ── TODO: ticket_groups and ticket_types ──────────────────────────────────
    // Full Test Event ticket types (all $0 for testing):
    //   "Room Lead Pass":  room_lead=true,  room_required_at_purchase=false
    //   "Roommate Pass":   room_lead=false
    //   "Volunteer Pass":  room_lead=false, volunteer_hours_required=4
    // Uncomment when migration 20260101000005_create_ticket_types_and_groups.sql is applied.
    warn('TODO: ticket_types — uncomment after migration 20260101000005')

    // ── TODO: merchandise ─────────────────────────────────────────────────────
    // Full Test Event merchandise (all $0):
    //   "Event T-Shirt":  ticket_type_restriction=[] (unrestricted)
    //   "VIP Lanyard":    ticket_type_restriction=[Room Lead Pass ticket type ID]
    // Uncomment when migration 20260101000007_create_merchandise.sql is applied.
    warn('TODO: merchandise — uncomment after migration 20260101000007')

    // ── TODO: event_attendees + orders ────────────────────────────────────────
    // Pre-seeded attendee state for Full Test Event:
    //   user1: Room Lead Pass, ticket_status=Complete, is_room_lead=true, completed order
    //   user2: Roommate Pass,  ticket_status=Complete, is_room_lead=false, completed order
    //   user3: Roommate Pass,  ticket_status=Complete, is_room_lead=false, completed order
    //   user4: Volunteer Pass, ticket_status=Complete, volunteer_hours_required=4, completed order
    //   user5: no ticket (ticket_status=Incomplete)
    // Uncomment when migrations 20260101000004 and 20260101000006 are applied.
    warn('TODO: event_attendees + orders — uncomment after migrations 20260101000004 and 20260101000006')

    // ── TODO: volunteer_shifts ────────────────────────────────────────────────
    // 3 shifts for Full Test Event:
    //   Shift A: day 1 at 10:00, duration=60min, capacity=5
    //   Shift B: day 1 at 10:30, duration=60min, capacity=3  ← overlaps Shift A (tests constraint)
    //   Shift C: day 2 at 14:00, duration=90min, capacity=4
    // Uncomment when migration 20260101000013_create_volunteer_shifts.sql is applied.
    warn('TODO: volunteer_shifts — uncomment after migration 20260101000013')

    // ── TODO: event_room_config (blocking) ────────────────────────────────────
    // Block 2 rooms on Full Test Event:
    //   King Studio #1: blocked=true, block_note="Staff"
    //   King Studio #2: blocked=true, block_note="Playroom"
    // Uncomment when migration 20260101000008_create_event_room_config.sql is applied.
    warn('TODO: event_room_config blocks — uncomment after migration 20260101000008')

    ok('Phase 2 stubs complete (no data inserted — platform migrations not yet applied).')

  } catch (err) {
    warn('Platform tables not yet available — run platform migrations first.')
    console.log('  Detail:', err instanceof Error ? err.message : String(err))
    warn('Skipping Phase 2.')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================================')
  console.log('  SD Platform — Development Seed Script')
  console.log('========================================================')
  console.log(`  Supabase URL: ${supabaseUrl}`)
  console.log(`  Test user DOB: ${dob} (30 years ago)`)
  console.log('\n  WARNING: Development only. NEVER run against production.\n')

  const authUserIds = await seedBadgeMakerTables()
  await seedPlatformTables(authUserIds)

  console.log('\n========================================================')
  console.log('  Seed complete.')
  console.log('  admin@test.local     / Admin1234!   (System Administrator)')
  console.log('  promoter@test.local  / Promo1234!   (Event Promoter)')
  console.log('  user1@test.local     / User1234!    (Room Lead)')
  console.log('  user2@test.local     / User1234!    (Roommate)')
  console.log('  user3@test.local     / User1234!    (Roommate, hidden in Roommate Finder)')
  console.log('  user4@test.local     / User1234!    (Volunteer ticket)')
  console.log('  user5@test.local     / User1234!    (No ticket)')
  console.log('========================================================\n')
}

main().catch((err) => {
  console.error('\nUnhandled error:', err)
  process.exit(1)
})
