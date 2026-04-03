/**
 * SD Platform — Development Seed Script
 *
 * Run: npm run seed
 *
 * WARNING: Development and staging environments ONLY.
 * NEVER run against the production database.
 *
 * The script asks two questions before doing anything:
 *
 *   Q1 — Create EP and basic users?
 *        Yes: creates promoter@test.local, user1@test.local, user2@test.local
 *        No:  only admin@test.local is created — use this when you want to test
 *             the full account registration flow from scratch
 *
 *   Q2 — Seed sample data? (only asked if Q1 is Yes)
 *        Yes: creates venue, rooms, platform events, ticket types, merchandise,
 *             application form, volunteer shifts, and room blocks
 *        No:  accounts only, no event data
 *
 * admin@test.local / Admin1234! is always created regardless of answers.
 */

import * as readline from 'readline'
import { createClient } from '@supabase/supabase-js'

// ── Interactive prompt helper ─────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`  ${question} [y/N] `, (answer) => {
      const normalized = answer.trim().toLowerCase()
      resolve(normalized === 'y' || normalized === 'yes')
    })
  })
}

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

const ADMIN_ACCOUNT = { email: 'admin@test.local', password: 'Admin1234!', label: 'System Administrator' } as const

const EXTRA_ACCOUNTS = [
  { email: 'promoter@test.local', password: 'Promo1234!', label: 'Event Promoter' },
  { email: 'user1@test.local',    password: 'User1234!',  label: 'User' },
  { email: 'user2@test.local',    password: 'User1234!',  label: 'User' },
] as const

// ── Stable seed UUIDs ─────────────────────────────────────────────────────────
// Fixed UUIDs make the seed script idempotent and allow safe re-runs.

const ORG_ID          = 'aaaaaaaa-0000-0000-0000-000000000000' // Test Organization
const VENUE_ID        = 'aaaaaaaa-0000-0000-0000-000000000001'
const FULL_EVENT_ID   = 'aaaaaaaa-0000-0000-0000-000000000002'
const MINIMAL_EVENT_ID = 'aaaaaaaa-0000-0000-0000-000000000003'

// Workflow status UUIDs — Full Test Event
const WS_APP_OPEN     = 'bbbbbbbb-0000-0000-0000-000000000001' // Applications Open
const WS_APP_CLOSED   = 'bbbbbbbb-0000-0000-0000-000000000002' // Applications Closed
const WS_TKT_OPEN     = 'bbbbbbbb-0000-0000-0000-000000000003' // Tickets Open
const WS_TKT_CLOSED   = 'bbbbbbbb-0000-0000-0000-000000000004' // Tickets Closed
const WS_ROOMS_OPEN   = 'bbbbbbbb-0000-0000-0000-000000000005' // Rooms Open
const WS_ROOMS_CLOSED = 'bbbbbbbb-0000-0000-0000-000000000006' // Rooms Closed
// Minimal Event
const WS_MIN_TKT_OPEN = 'bbbbbbbb-0000-0000-0000-000000000007' // Minimal: Tickets Open

// Ticket type UUIDs
const TICKET_RL   = 'cccccccc-0000-0000-0000-000000000001' // Room Lead Pass
const TICKET_RM   = 'cccccccc-0000-0000-0000-000000000002' // Roommate Pass
const TICKET_VOL  = 'cccccccc-0000-0000-0000-000000000003' // Volunteer Pass
const TICKET_MIN  = 'cccccccc-0000-0000-0000-000000000004' // Minimal Event General

// Merchandise UUIDs
const MERCH_SHIRT   = 'dddddddd-0000-0000-0000-000000000001' // Event T-Shirt
const MERCH_LANYARD = 'dddddddd-0000-0000-0000-000000000002' // VIP Lanyard

// Room UUIDs
const ROOM_KS1 = 'eeeeeeee-0000-0000-0000-000000000001' // King Studio 1
const ROOM_KS2 = 'eeeeeeee-0000-0000-0000-000000000002' // King Studio 2
const ROOM_KS3 = 'eeeeeeee-0000-0000-0000-000000000003' // King Studio 3
const ROOM_QD1 = 'eeeeeeee-0000-0000-0000-000000000004' // Queen Double 1
const ROOM_QD2 = 'eeeeeeee-0000-0000-0000-000000000005' // Queen Double 2
const ROOM_QD3 = 'eeeeeeee-0000-0000-0000-000000000006' // Queen Double 3
const ROOM_QD4 = 'eeeeeeee-0000-0000-0000-000000000007' // Queen Double 4
const ROOM_BK1 = 'eeeeeeee-0000-0000-0000-000000000008' // Bunk Room 1
const ROOM_BK2 = 'eeeeeeee-0000-0000-0000-000000000009' // Bunk Room 2
const ROOM_BK3 = 'eeeeeeee-0000-0000-0000-00000000000a' // Bunk Room 3

// Volunteer shift UUIDs
const SHIFT_A = 'ffffffff-0000-0000-0000-000000000001' // Day 1 10:00 (overlaps B)
const SHIFT_B = 'ffffffff-0000-0000-0000-000000000002' // Day 1 10:30 (overlaps A)
const SHIFT_C = 'ffffffff-0000-0000-0000-000000000003' // Day 2 14:00
const SHIFT_D = 'ffffffff-0000-0000-0000-000000000004' // Day 2 17:00 (non-overlapping; A+C+D = 4h)

// ── Phase 1: Auth accounts + badge-maker tables ───────────────────────────────
// These tables exist in the current production schema (supabase/schema.sql).

async function seedBadgeMakerTables(createAllUsers: boolean, seedData: boolean) {
  section('Phase 1: Auth Accounts' + (seedData ? ' + Badge-Maker Tables' : ''))

  // ── Auth accounts ────────────────────────────────────────────────────────────
  console.log('\n  Auth accounts...')
  const authUserIds: Record<string, string> = {}

  const accountsToCreate = [
    ADMIN_ACCOUNT,
    ...(createAllUsers ? EXTRA_ACCOUNTS : []),
  ]

  // Fetch existing users once to avoid repeated listUsers calls
  const { data: existingUsers } = await supabase.auth.admin.listUsers()

  for (const account of accountsToCreate) {
    const found = existingUsers?.users?.find(u => u.email === account.email)

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

  // ── Badge-maker template + events (only needed for sample data) ──────────────
  if (seedData) {
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
  }

  ok('Phase 1 complete.')
  return authUserIds
}

// ── Phase 2: Platform tables ──────────────────────────────────────────────────
// Requires platform migrations to be applied (supabase db push).
// Gracefully skips if platform_users table does not exist.

async function seedPlatformTables(authUserIds: Record<string, string>, createAllUsers: boolean, seedData: boolean) {
  section('Phase 2: Platform Tables (requires platform migrations)')

  try {
    // Test whether platform_users table exists
    const { error: tableCheckError } = await supabase
      .from('platform_users')
      .select('id')
      .limit(1)

    if (tableCheckError) {
      warn('Platform tables not yet available.')
      warn('Apply platform migrations first:')
      warn('  npx supabase db push')
      warn('Skipping Phase 2.')
      return
    }

    // ── platform_users ────────────────────────────────────────────────────────
    console.log('\n  platform_users...')
    const allPlatformUsers = [
      {
        id: authUserIds['admin@test.local'],
        role: 'system_admin',
        email: 'admin@test.local',
        date_of_birth: dob,
        preferred_scene_name: 'Admin',
        roommate_finder_hidden: false,
      },
      ...(createAllUsers ? [
        {
          id: authUserIds['promoter@test.local'],
          role: 'event_promoter',
          email: 'promoter@test.local',
          date_of_birth: dob,
          preferred_scene_name: 'Promoter',
          roommate_finder_hidden: false,
          payment_provider: 'square',
        },
        {
          id: authUserIds['user1@test.local'],
          role: 'user',
          email: 'user1@test.local',
          date_of_birth: dob,
          preferred_scene_name: 'TestUser1',
          roommate_finder_hidden: false,
        },
        {
          id: authUserIds['user2@test.local'],
          role: 'user',
          email: 'user2@test.local',
          date_of_birth: dob,
          preferred_scene_name: 'TestUser2',
          roommate_finder_hidden: false,
        },
      ] : []),
    ].filter(u => u.id) // skip accounts that failed to create

    for (const u of allPlatformUsers) {
      const { error } = await supabase
        .from('platform_users')
        .upsert(u, { onConflict: 'id' })
      if (error) warn(`platform_users upsert failed for ${u.email}: ${error.message}`)
      else ok(`platform_user: ${u.email} (${u.role})`)
    }

    // ── organization ───────────────────────────────────────────────────────────
    console.log('\n  organization...')
    const promoterId = authUserIds['promoter@test.local']

    // Fetch the free tier ID
    const { data: freeTier } = await supabase
      .from('organization_tiers')
      .select('id')
      .eq('name', 'free')
      .single()

    if (!freeTier) fail('Free tier not found. Run migrations first.')

    const { error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: ORG_ID,
        name: 'Test Organization',
        slug: 'test-org',
        website: 'https://test-org.example.com',
        payment_provider: 'square',
        tier_id: freeTier.id,
        archived: false,
      }, { onConflict: 'id' })
    if (orgError) warn(`organizations upsert failed: ${orgError.message}`)
    else ok('organization: Test Organization')

    // ── organization members ─────────────────────────────────────────────────
    console.log('\n  organization members...')
    const orgMembers = [
      { organization_id: ORG_ID, user_id: authUserIds['admin@test.local'],    access_level: 'organization_lead', promoted_via_org: false },
      ...(promoterId ? [{ organization_id: ORG_ID, user_id: promoterId, access_level: 'organization_lead' as const, promoted_via_org: true }] : []),
    ].filter(m => m.user_id)

    for (const m of orgMembers) {
      const { error } = await supabase
        .from('organization_members')
        .upsert(m, { onConflict: 'organization_id,user_id' })
      if (error) warn(`org_members upsert failed for ${m.user_id}: ${error.message}`)
      else ok(`org_member: ${m.user_id} (${m.access_level})`)
    }

    if (!seedData) {
      ok('Phase 2 complete.')
      return
    }

    // ── venue ─────────────────────────────────────────────────────────────────
    console.log('\n  venues...')
    if (promoterId) {
      const { error } = await supabase
        .from('venues')
        .upsert(
          {
            id: VENUE_ID,
            owner_id: promoterId,
            organization_id: ORG_ID,
            name: 'Test Venue',
            physical_address: '123 Test Street, Test City, TX 75001',
            email: 'hotel@test.local',
            phone: '555-0100',
          },
          { onConflict: 'id' }
        )
      if (error) warn(`venues upsert failed: ${error.message}`)
      else ok('Test Venue')
    }

    // ── rooms ─────────────────────────────────────────────────────────────────
    // 10 rooms for Test Venue. room_daily_rates covers 3 check-in nights
    // (Thu Oct 1, Fri Oct 2, Sat Oct 3) for the Full Test Event (Oct 1-5).
    console.log('\n  rooms...')
    const rooms = [
      { id: ROOM_KS1, venue_id: VENUE_ID, number: 'KS-101', name: 'King Studio',   lodging_type: 'Studio',       bed_type: 'King',         bed_spot_count: 2, min_occupancy: 1, room_group: 'King Studios',   room_daily_rates: [{ date: 'Thursday', amount: 200.00 }, { date: 'Friday', amount: 225.00 }, { date: 'Saturday', amount: 225.00 }] },
      { id: ROOM_KS2, venue_id: VENUE_ID, number: 'KS-102', name: 'King Studio',   lodging_type: 'Studio',       bed_type: 'King',         bed_spot_count: 2, min_occupancy: 1, room_group: 'King Studios',   room_daily_rates: [{ date: 'Thursday', amount: 200.00 }, { date: 'Friday', amount: 225.00 }, { date: 'Saturday', amount: 225.00 }] },
      { id: ROOM_KS3, venue_id: VENUE_ID, number: 'KS-103', name: 'King Studio',   lodging_type: 'Studio',       bed_type: 'King',         bed_spot_count: 2, min_occupancy: 1, room_group: 'King Studios',   room_daily_rates: [{ date: 'Thursday', amount: 200.00 }, { date: 'Friday', amount: 225.00 }, { date: 'Saturday', amount: 225.00 }] },
      { id: ROOM_QD1, venue_id: VENUE_ID, number: 'QD-201', name: 'Queen Double',  lodging_type: 'Suite',        bed_type: 'Queen',        bed_spot_count: 2, min_occupancy: 2, room_group: 'Queen Doubles',  room_daily_rates: [{ date: 'Thursday', amount: 175.00 }, { date: 'Friday', amount: 195.00 }, { date: 'Saturday', amount: 195.00 }] },
      { id: ROOM_QD2, venue_id: VENUE_ID, number: 'QD-202', name: 'Queen Double',  lodging_type: 'Suite',        bed_type: 'Queen',        bed_spot_count: 2, min_occupancy: 2, room_group: 'Queen Doubles',  room_daily_rates: [{ date: 'Thursday', amount: 175.00 }, { date: 'Friday', amount: 195.00 }, { date: 'Saturday', amount: 195.00 }] },
      { id: ROOM_QD3, venue_id: VENUE_ID, number: 'QD-203', name: 'Queen Double',  lodging_type: 'Suite',        bed_type: 'Queen',        bed_spot_count: 2, min_occupancy: 2, room_group: 'Queen Doubles',  room_daily_rates: [{ date: 'Thursday', amount: 175.00 }, { date: 'Friday', amount: 195.00 }, { date: 'Saturday', amount: 195.00 }] },
      { id: ROOM_QD4, venue_id: VENUE_ID, number: 'QD-204', name: 'Queen Double',  lodging_type: 'Suite',        bed_type: 'Queen',        bed_spot_count: 2, min_occupancy: 2, room_group: 'Queen Doubles',  room_daily_rates: [{ date: 'Thursday', amount: 175.00 }, { date: 'Friday', amount: 195.00 }, { date: 'Saturday', amount: 195.00 }] },
      { id: ROOM_BK1, venue_id: VENUE_ID, number: 'BK-301', name: 'Bunk Room',     lodging_type: 'Shared',       bed_type: 'Bunk',         bed_spot_count: 4, min_occupancy: 2, room_group: 'Bunk Rooms',     room_daily_rates: [{ date: 'Thursday', amount: 100.00 }, { date: 'Friday', amount: 115.00 }, { date: 'Saturday', amount: 115.00 }] },
      { id: ROOM_BK2, venue_id: VENUE_ID, number: 'BK-302', name: 'Bunk Room',     lodging_type: 'Shared',       bed_type: 'Bunk',         bed_spot_count: 4, min_occupancy: 2, room_group: 'Bunk Rooms',     room_daily_rates: [{ date: 'Thursday', amount: 100.00 }, { date: 'Friday', amount: 115.00 }, { date: 'Saturday', amount: 115.00 }] },
      { id: ROOM_BK3, venue_id: VENUE_ID, number: 'BK-303', name: 'Bunk Room',     lodging_type: 'Shared',       bed_type: 'Bunk',         bed_spot_count: 4, min_occupancy: 2, room_group: 'Bunk Rooms',     room_daily_rates: [{ date: 'Thursday', amount: 100.00 }, { date: 'Friday', amount: 115.00 }, { date: 'Saturday', amount: 115.00 }] },
    ]
    for (const room of rooms) {
      const { error } = await supabase.from('rooms').upsert(room, { onConflict: 'id' })
      if (error) warn(`rooms upsert failed for ${room.number}: ${error.message}`)
      else ok(`room: ${room.number} ${room.name}`)
    }

    // ── platform_events ───────────────────────────────────────────────────────
    console.log('\n  platform_events...')
    if (promoterId) {
      // Full Test Event workflow statuses
      const fullWorkflowStatuses = [
        { id: WS_APP_OPEN,     name: 'Applications Open',   order: 1, description: 'Application module opens for attendees' },
        { id: WS_APP_CLOSED,   name: 'Applications Closed', order: 2, description: 'Application module closes' },
        { id: WS_TKT_OPEN,     name: 'Tickets Open',        order: 3, description: 'Ticketing module opens for approved applicants' },
        { id: WS_TKT_CLOSED,   name: 'Tickets Closed',      order: 4, description: 'Ticketing closes' },
        { id: WS_ROOMS_OPEN,   name: 'Rooms Open',          order: 5, description: 'Room selection opens for ticket holders' },
        { id: WS_ROOMS_CLOSED, name: 'Rooms Closed',        order: 6, description: 'Room selection closes' },
      ]

      const fullModuleConfig = {
        application: {
          enabled: true,
          required: true,
          opens_at_status: WS_APP_OPEN,
          closes_at_status: WS_APP_CLOSED,
        },
        ticketing: {
          enabled: true,
          required: true,
          opens_at_status: WS_TKT_OPEN,
          closes_at_status: null,
        },
        waiver: {
          enabled: true,
          required: true,
          opens_at_status: WS_TKT_OPEN,
          closes_at_status: null,
        },
        room_selection: {
          enabled: true,
          required: false,
          opens_at_status: WS_ROOMS_OPEN,
          closes_at_status: WS_ROOMS_CLOSED,
        },
        volunteering: {
          enabled: true,
          required: false,
          opens_at_status: WS_TKT_OPEN,
          closes_at_status: null,
        },
        schedule: {
          enabled: true,
          required: false,
          opens_at_status: 'Published',
          closes_at_status: null,
        },
        badge: {
          enabled: true,
          required: false,
          opens_at_status: WS_TKT_OPEN,
          closes_at_status: null,
        },
      }

      const fullCancellationPolicy = {
        checkpoints: [
          { status_id: WS_APP_OPEN, refund_percentage: 100 },
          { status_id: WS_TKT_OPEN, refund_percentage: 50 },
        ],
      }

      const { error: fullEventError } = await supabase
        .from('platform_events')
        .upsert(
          {
            id: FULL_EVENT_ID,
            slug: 'test-full-event',
            owner_id: promoterId,
            organization_id: ORG_ID,
            title: 'Full Test Event',
            description: 'All modules enabled — used for manual flow verification',
            start_date: '2026-10-01',
            end_date: '2026-10-05',
            venue_id: VENUE_ID,
            status: 'Tickets Open',
            workflow_statuses: fullWorkflowStatuses,
            module_config: fullModuleConfig,
            cancellation_policy: fullCancellationPolicy,
            room_lock_in_date: '2026-09-01T00:00:00Z',
            room_closed_date: '2026-09-15T00:00:00Z',
          },
          { onConflict: 'id' }
        )
      if (fullEventError) warn(`platform_events upsert failed (Full): ${fullEventError.message}`)
      else ok('platform_event: Full Test Event')

      // Minimal Test Event
      const minWorkflowStatuses = [
        { id: WS_MIN_TKT_OPEN, name: 'Tickets Open', order: 1, description: 'Ticketing opens' },
      ]
      const { error: minEventError } = await supabase
        .from('platform_events')
        .upsert(
          {
            id: MINIMAL_EVENT_ID,
            slug: 'test-minimal-event',
            owner_id: promoterId,
            organization_id: ORG_ID,
            title: 'Minimal Test Event',
            description: 'Ticketing only',
            start_date: '2026-11-01',
            end_date: '2026-11-03',
            status: 'Tickets Open',
            workflow_statuses: minWorkflowStatuses,
            module_config: {
              ticketing: { enabled: true, required: true, opens_at_status: WS_MIN_TKT_OPEN, closes_at_status: null },
            },
            cancellation_policy: { checkpoints: [] },
          },
          { onConflict: 'id' }
        )
      if (minEventError) warn(`platform_events upsert failed (Minimal): ${minEventError.message}`)
      else ok('platform_event: Minimal Test Event')
    }

    // ── ticket_types ──────────────────────────────────────────────────────────
    console.log('\n  ticket_types...')
    const ticketTypes = [
      // Full Test Event
      { id: TICKET_RL,  event_id: FULL_EVENT_ID,    name: 'Room Lead Pass', description: 'Designates purchaser as Room Lead',              price: 0, room_lead: true,  roommate_codes_enabled: true,  volunteer_hours_required: 0, room_required_at_purchase: false },
      { id: TICKET_RM,  event_id: FULL_EVENT_ID,    name: 'Roommate Pass',  description: 'Standard attendee ticket',                      price: 0, room_lead: false, volunteer_hours_required: 0, room_required_at_purchase: false },
      { id: TICKET_VOL, event_id: FULL_EVENT_ID,    name: 'Volunteer Pass', description: 'Requires 4 hours of volunteer shifts',           price: 0, room_lead: false, volunteer_hours_required: 4, room_required_at_purchase: false },
      // Minimal Test Event
      { id: TICKET_MIN, event_id: MINIMAL_EVENT_ID, name: 'General Admission', description: 'Single ticket type for minimal test event',  price: 0, room_lead: false, volunteer_hours_required: 0, room_required_at_purchase: false },
    ]
    for (const tt of ticketTypes) {
      const { error } = await supabase.from('ticket_types').upsert(tt, { onConflict: 'id' })
      if (error) warn(`ticket_types upsert failed for ${tt.name}: ${error.message}`)
      else ok(`ticket_type: ${tt.name}`)
    }

    // ── merchandise ───────────────────────────────────────────────────────────
    console.log('\n  merchandise...')
    const merch = [
      {
        id: MERCH_SHIRT,
        event_id: FULL_EVENT_ID,
        name: 'Event T-Shirt',
        description: 'Official event t-shirt — available to all attendees',
        price: 0,
        available_count: null, // unlimited
        ticket_type_restriction: [], // unrestricted
        enabled: true,
      },
      {
        id: MERCH_LANYARD,
        event_id: FULL_EVENT_ID,
        name: 'VIP Lanyard',
        description: 'Exclusive lanyard for Room Lead ticket holders only',
        price: 0,
        available_count: null,
        ticket_type_restriction: [TICKET_RL], // Room Lead Pass only
        enabled: true,
      },
    ]
    for (const m of merch) {
      const { error } = await supabase.from('merchandise').upsert(m, { onConflict: 'id' })
      if (error) warn(`merchandise upsert failed for ${m.name}: ${error.message}`)
      else ok(`merchandise: ${m.name}`)
    }

    // ── application_forms ─────────────────────────────────────────────────────
    // Seed a 4-field application form for the Full Test Event.
    // No responses are pre-seeded — users submit them during the workflow.
    console.log('\n  application_forms...')
    const APP_FORM_ID = 'ffffffff-aaaa-0000-0000-000000000001'
    const AF_FIELD_SCENE  = 'ffffffff-aaaa-0000-0000-000000000011'
    const AF_FIELD_HEARD  = 'ffffffff-aaaa-0000-0000-000000000012'
    const AF_FIELD_ACTS   = 'ffffffff-aaaa-0000-0000-000000000013'
    const AF_FIELD_SM     = 'ffffffff-aaaa-0000-0000-000000000014'

    const { error: formError } = await supabase
      .from('application_forms')
      .upsert(
        {
          id: APP_FORM_ID,
          event_id: FULL_EVENT_ID,
          source_form_id: null,
          title: 'Full Test Event Application',
          fields: [
            { id: AF_FIELD_SCENE, type: 'text',     label: 'What is your preferred scene name?',       options: [],                                                               required: true,  order: 1 },
            { id: AF_FIELD_HEARD, type: 'radio',    label: 'How did you hear about this event?',        options: ['Friend', 'Social Media', 'Prior event'],                        required: true,  order: 2 },
            { id: AF_FIELD_ACTS,  type: 'checkbox', label: 'Which activities interest you?',            options: ['Kink education', 'Social dancing', 'Play parties', 'Workshops'], required: false, order: 3 },
            { id: AF_FIELD_SM,    type: 'key_value', label: 'Share a social media handle (optional)',   options: [],                                                               required: false, order: 4 },
          ],
        },
        { onConflict: 'id' }
      )
    if (formError) warn(`application_forms upsert failed: ${formError.message}`)
    else ok('application_form: Full Test Event Application')

    // ── volunteer_shifts ──────────────────────────────────────────────────────
    // Shift A and B intentionally overlap to test the overlap constraint.
    console.log('\n  volunteer_shifts...')
    const shifts = [
      { id: SHIFT_A, event_id: FULL_EVENT_ID, name: 'Registration Desk',   date_time: '2026-10-01T10:00:00Z', duration_minutes: 60, capacity: 5 },
      { id: SHIFT_B, event_id: FULL_EVENT_ID, name: 'Welcome Booth',       date_time: '2026-10-01T10:30:00Z', duration_minutes: 60, capacity: 3 }, // overlaps Shift A
      { id: SHIFT_C, event_id: FULL_EVENT_ID, name: 'Afternoon Activities', date_time: '2026-10-02T14:00:00Z', duration_minutes: 90, capacity: 4 },
      { id: SHIFT_D, event_id: FULL_EVENT_ID, name: 'Evening Cleanup',      date_time: '2026-10-02T17:00:00Z', duration_minutes: 90, capacity: 4 },
    ]
    for (const s of shifts) {
      const { error } = await supabase.from('volunteer_shifts').upsert(s, { onConflict: 'id' })
      if (error) warn(`volunteer_shifts upsert failed for ${s.name}: ${error.message}`)
      else ok(`volunteer_shift: ${s.name} (${s.date_time.slice(0, 16)}, ${s.duration_minutes}min, cap=${s.capacity})`)
    }

    // ── event_room_config — 2 blocked rooms ──────────────────────────────────
    // KS-101 → Staff, KS-102 → Playroom
    console.log('\n  event_room_config (blocks)...')
    const roomBlocks = [
      { event_id: FULL_EVENT_ID, room_id: ROOM_KS1, blocked: true, block_note: 'Staff',     reserved: false },
      { event_id: FULL_EVENT_ID, room_id: ROOM_KS2, blocked: true, block_note: 'Playroom',  reserved: false },
    ]
    for (const rb of roomBlocks) {
      const { error } = await supabase
        .from('event_room_config')
        .upsert(rb, { onConflict: 'event_id,room_id' })
      if (error) warn(`event_room_config upsert failed for room ${rb.room_id}: ${error.message}`)
      else ok(`event_room_config: room ${rb.room_id.slice(0, 8)}... blocked=${rb.blocked} (${rb.block_note})`)
    }

    ok('Phase 2 complete.')

  } catch (err) {
    warn('Unexpected error in Phase 2.')
    console.log('  Detail:', err instanceof Error ? err.message : String(err))
    warn('Skipping Phase 2.')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function truncateAll() {
  section('Truncating all platform data + auth users')

  const tables = [
    'platform_notifications',
    'room_lock_requests',
    'roommate_applications',
    'user_volunteer_signups',
    'volunteer_shifts',
    'schedule_activities',
    'application_responses',
    'application_forms',
    'locks',
    'bed_blocks',
    'event_room_config',
    'merchandise',
    'order_items',
    'orders',
    'ticket_types',
    'ticket_groups',
    'event_attendees',
    'organization_module_access',
    'organization_invitations',
    'organization_members',
    'platform_events',
    'rooms',
    'venues',
    'organizations',
    'waiver_templates',
    'badge_templates',
  ]

  // Truncate all platform tables via individual deletes (service role bypasses RLS)
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) warn(`delete from ${table}: ${error.message}`)
    else ok(`cleared: ${table}`)
  }

  // platform_users separately (FK target for many tables, cleared after dependents)
  const { error: puErr } = await supabase.from('platform_users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (puErr) warn(`delete from platform_users: ${puErr.message}`)
  else ok('cleared: platform_users')

  // Clear auth users
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  for (const u of authUsers?.users ?? []) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) warn(`delete auth user ${u.email}: ${error.message}`)
    else ok(`deleted auth user: ${u.email}`)
  }

  ok('Truncation complete.')
}

async function main() {
  console.log('\n========================================================')
  console.log('  Lekd Platform — Development Seed Script')
  console.log('========================================================')
  console.log(`  Supabase URL: ${supabaseUrl}`)
  console.log(`  Test user DOB: ${dob} (30 years ago)`)
  console.log('\n  WARNING: Development only. NEVER run against production.')
  console.log('\n  admin@test.local / Admin1234! is always created.\n')

  const doTruncate = await ask('Truncate all data before seeding? (full reset)')
  if (doTruncate) {
    await truncateAll()
  }

  const createAllUsers = await ask('Create EP and basic test users? (promoter, user1, user2)')
  const seedData = createAllUsers
    ? await ask('Seed sample data? (venue, rooms, events, ticket types, shifts, etc.)')
    : false

  if (!createAllUsers) {
    console.log('\n  Skipping EP and basic users — only admin will be created.')
    console.log('  Register new accounts through the UI to test the full signup flow.\n')
  }
  if (createAllUsers && !seedData) {
    console.log('\n  Skipping sample data — accounts only.\n')
  }

  const authUserIds = await seedBadgeMakerTables(createAllUsers, seedData)
  await seedPlatformTables(authUserIds, createAllUsers, seedData)

  console.log('\n========================================================')
  console.log('  Seed complete.')
  console.log('  admin@test.local  / Admin1234!  (System Administrator)')
  if (createAllUsers) {
    console.log('  promoter@test.local  / Promo1234!  (Event Promoter)')
    console.log('  user1@test.local     / User1234!   (User)')
    console.log('  user2@test.local     / User1234!   (User)')
  }
  if (seedData) {
    console.log('')
    console.log('  Sample data seeded: Full Test Event + Minimal Test Event')
    console.log('  Log in as user1 or user2 to walk the full workflow.')
  }
  console.log('========================================================\n')
  rl.close()
}

main().catch((err) => {
  console.error('\nUnhandled error:', err)
  process.exit(1)
})
