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

// ── Accounting Seed ──────────────────────────────────────────────────────────
// Comprehensive seed for analytics/accounting testing.
// Creates 3 orgs, ~30 users, 10 historical events with 50+ attendees each,
// paid ticket types, orders, refunds, and 1 active event with all modules.

function uuid(prefix: string, n: number): string {
  return `${prefix}-0000-0000-0000-${String(n).padStart(12, '0')}`
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function createAuthUser(email: string, password: string): Promise<string | null> {
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find(u => u.email === email)
  if (found) return found.id

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) { warn(`Could not create ${email}: ${error.message}`); return null }
  return data.user.id
}

async function accountingSeed() {
  section('Accounting Seed — Truncating all data')
  await truncateAll()

  section('Accounting Seed — Creating users')

  // Fetch free tier
  const { data: freeTier } = await supabase
    .from('organization_tiers')
    .select('id')
    .eq('name', 'free')
    .single()
  if (!freeTier) fail('Free tier not found. Run migrations first.')

  // ── Create auth users ──────────────────────────────────────────────────────
  // 1 SA, 3 OLs, 6 EPs (2 per org), 6 MLs (2 per org), 60 attendee users
  const users: Record<string, string> = {}

  const saId = await createAuthUser('admin@test.local', 'Admin1234!')
  if (saId) users['admin@test.local'] = saId

  const orgNames = ['Shiny Dog Productions', 'Nightfall Events', 'Summit Gatherings']
  const orgSlugs = ['shiny-dog', 'nightfall', 'summit']
  const orgIds = orgSlugs.map((_, i) => uuid('aaaa0001', i + 1))

  // OLs (1 per org)
  for (let o = 0; o < 3; o++) {
    const email = `ol${o + 1}@test.local`
    const id = await createAuthUser(email, 'OrgLead1!')
    if (id) users[email] = id
  }
  // EPs (2 per org)
  for (let o = 0; o < 3; o++) {
    for (let e = 0; e < 2; e++) {
      const email = `ep${o * 2 + e + 1}@test.local`
      const id = await createAuthUser(email, 'EventPro1!')
      if (id) users[email] = id
    }
  }
  // MLs (2 per org)
  for (let o = 0; o < 3; o++) {
    for (let m = 0; m < 2; m++) {
      const email = `ml${o * 2 + m + 1}@test.local`
      const id = await createAuthUser(email, 'ModLead1!')
      if (id) users[email] = id
    }
  }
  // Attendee users (60 total — enough for 50+ per event with some overlap)
  for (let i = 1; i <= 60; i++) {
    const email = `attendee${i}@test.local`
    const id = await createAuthUser(email, 'Attend1!')
    if (id) users[email] = id
  }
  ok(`Created ${Object.keys(users).length} auth users`)

  // ── platform_users ─────────────────────────────────────────────────────────
  section('Accounting Seed — Platform users')
  const sceneNames = [
    'Phoenix', 'Raven', 'Storm', 'Blaze', 'Frost', 'Shadow', 'Echo', 'Viper',
    'Luna', 'Ember', 'Drake', 'Nova', 'Hawk', 'Sage', 'Wolf', 'Onyx',
    'Atlas', 'Zephyr', 'Jade', 'Orion', 'Ivy', 'Rex', 'Cleo', 'Kai',
    'Mira', 'Axel', 'Rune', 'Nyx', 'Dex', 'Aria', 'Jett', 'Vale',
    'Sable', 'Quinn', 'Dash', 'Lyra', 'Brock', 'Fern', 'Thorn', 'Pip',
    'Slate', 'Wren', 'Flint', 'Opal', 'Cruz', 'Lark', 'Haze', 'Mica',
    'Sly', 'Bolt', 'Coral', 'Pike', 'Dusk', 'Elm', 'Grit', 'Ash',
    'Bay', 'Clove', 'Reed', 'Spark',
  ]

  const platformUsers: { id: string; role: string; email: string; date_of_birth: string; preferred_scene_name: string; first_name: string; last_name: string; emergency_contact: string; emergency_phone: string; roommate_finder_hidden: boolean }[] = []

  // Admin
  if (users['admin@test.local']) {
    platformUsers.push({
      id: users['admin@test.local'], role: 'system_admin', email: 'admin@test.local',
      date_of_birth: dob, preferred_scene_name: 'SysAdmin', first_name: 'Admin', last_name: 'User',
      emergency_contact: 'Emergency Admin', emergency_phone: '555-0000', roommate_finder_hidden: false,
    })
  }
  // OLs, EPs, MLs
  for (let o = 0; o < 3; o++) {
    const olEmail = `ol${o + 1}@test.local`
    if (users[olEmail]) {
      platformUsers.push({
        id: users[olEmail], role: 'event_promoter', email: olEmail,
        date_of_birth: dob, preferred_scene_name: `OrgLead_${orgSlugs[o]}`, first_name: `Org${o + 1}`, last_name: 'Lead',
        emergency_contact: 'Emergency OL', emergency_phone: '555-0100', roommate_finder_hidden: false,
      })
    }
    for (let e = 0; e < 2; e++) {
      const epEmail = `ep${o * 2 + e + 1}@test.local`
      if (users[epEmail]) {
        platformUsers.push({
          id: users[epEmail], role: 'event_promoter', email: epEmail,
          date_of_birth: dob, preferred_scene_name: `EP_${orgSlugs[o]}_${e + 1}`, first_name: `EP${o * 2 + e + 1}`, last_name: 'Promoter',
          emergency_contact: 'Emergency EP', emergency_phone: '555-0200', roommate_finder_hidden: false,
        })
      }
    }
    for (let m = 0; m < 2; m++) {
      const mlEmail = `ml${o * 2 + m + 1}@test.local`
      if (users[mlEmail]) {
        platformUsers.push({
          id: users[mlEmail], role: 'event_promoter', email: mlEmail,
          date_of_birth: dob, preferred_scene_name: `ML_${orgSlugs[o]}_${m + 1}`, first_name: `ML${o * 2 + m + 1}`, last_name: 'Lead',
          emergency_contact: 'Emergency ML', emergency_phone: '555-0300', roommate_finder_hidden: false,
        })
      }
    }
  }
  // Attendees
  for (let i = 1; i <= 60; i++) {
    const email = `attendee${i}@test.local`
    if (users[email]) {
      platformUsers.push({
        id: users[email], role: 'user', email,
        date_of_birth: dob, preferred_scene_name: sceneNames[i - 1] ?? `Attendee${i}`, first_name: `User${i}`, last_name: 'Test',
        emergency_contact: 'Emergency Contact', emergency_phone: '555-9999', roommate_finder_hidden: false,
      })
    }
  }

  for (const u of platformUsers) {
    const { error } = await supabase.from('platform_users').upsert(u, { onConflict: 'id' })
    if (error) warn(`platform_users: ${u.email}: ${error.message}`)
  }
  ok(`Upserted ${platformUsers.length} platform users`)

  // ── Organizations ──────────────────────────────────────────────────────────
  section('Accounting Seed — Organizations')
  for (let o = 0; o < 3; o++) {
    const { error } = await supabase.from('organizations').upsert({
      id: orgIds[o],
      name: orgNames[o],
      slug: orgSlugs[o],
      website: `https://${orgSlugs[o]}.example.com`,
      payment_provider: o === 0 ? 'square' : 'paypal',
      tier_id: freeTier.id,
      archived: false,
    }, { onConflict: 'id' })
    if (error) warn(`org: ${error.message}`)
    else ok(`org: ${orgNames[o]}`)
  }

  // ── Organization members ───────────────────────────────────────────────────
  section('Accounting Seed — Org members')
  const memberIds: Record<string, string> = {} // email -> member record id

  for (let o = 0; o < 3; o++) {
    const orgId = orgIds[o]
    const members = [
      { email: `ol${o + 1}@test.local`, access_level: 'organization_lead' },
      { email: `ep${o * 2 + 1}@test.local`, access_level: 'event_promoter' },
      { email: `ep${o * 2 + 2}@test.local`, access_level: 'event_promoter' },
      { email: `ml${o * 2 + 1}@test.local`, access_level: 'module_lead' },
      { email: `ml${o * 2 + 2}@test.local`, access_level: 'module_lead' },
    ]

    for (const m of members) {
      const userId = users[m.email]
      if (!userId) continue
      const memberId = uuid('bbbb0001', o * 10 + members.indexOf(m) + 1)
      const { error } = await supabase.from('organization_members').upsert({
        id: memberId,
        organization_id: orgId,
        user_id: userId,
        access_level: m.access_level,
        promoted_via_org: m.access_level !== 'organization_lead',
      }, { onConflict: 'organization_id,user_id' })
      if (error) warn(`org_member ${m.email}: ${error.message}`)
      else {
        ok(`org_member: ${m.email} → ${orgNames[o]} (${m.access_level})`)
        memberIds[m.email] = memberId
      }
    }
  }

  // ── Module access for MLs ──────────────────────────────────────────────────
  console.log('\n  Module Lead access grants...')
  const moduleKeys = ['ticketing', 'volunteering', 'schedule']
  for (let o = 0; o < 3; o++) {
    for (let m = 0; m < 2; m++) {
      const mlEmail = `ml${o * 2 + m + 1}@test.local`
      const mId = memberIds[mlEmail]
      if (!mId) continue
      for (const mk of moduleKeys) {
        const { error } = await supabase.from('organization_module_access').upsert({
          organization_member_id: mId,
          module_key: mk,
        }, { onConflict: 'organization_member_id,module_key' })
        if (error) warn(`module_access ${mlEmail}/${mk}: ${error.message}`)
      }
      ok(`ML grants: ${mlEmail} → ${moduleKeys.join(', ')}`)
    }
  }

  // ── Venues (1 per org) ─────────────────────────────────────────────────────
  section('Accounting Seed — Venues')
  const venueIds = orgSlugs.map((_, i) => uuid('cccc0001', i + 1))
  for (let o = 0; o < 3; o++) {
    const olEmail = `ol${o + 1}@test.local`
    const { error } = await supabase.from('venues').upsert({
      id: venueIds[o],
      owner_id: users[olEmail],
      organization_id: orgIds[o],
      name: `${orgNames[o]} Hotel`,
      physical_address: `${100 + o} Main St, City ${o + 1}, TX 75001`,
      email: `hotel${o + 1}@test.local`,
    }, { onConflict: 'id' })
    if (error) warn(`venue: ${error.message}`)
    else ok(`venue: ${orgNames[o]} Hotel`)
  }

  // ── Historical events (10 total, ~3-4 per org) ─────────────────────────────
  section('Accounting Seed — Historical events + active event')

  // Event date spread: one every ~45 days going back 18 months
  const now = new Date()
  const eventConfigs: { orgIdx: number; title: string; monthsAgo: number }[] = [
    { orgIdx: 0, title: 'Summer Splash 2024',    monthsAgo: 18 },
    { orgIdx: 1, title: 'Autumn Retreat 2024',    monthsAgo: 16 },
    { orgIdx: 2, title: 'Winter Gathering 2024',  monthsAgo: 14 },
    { orgIdx: 0, title: 'Spring Fling 2025',      monthsAgo: 12 },
    { orgIdx: 1, title: 'Summer Heat 2025',       monthsAgo: 10 },
    { orgIdx: 2, title: 'Fall Festival 2025',     monthsAgo: 8 },
    { orgIdx: 0, title: 'Holiday Bash 2025',      monthsAgo: 6 },
    { orgIdx: 1, title: 'New Year Kickoff 2026',  monthsAgo: 4 },
    { orgIdx: 2, title: 'Valentine Mixer 2026',   monthsAgo: 3 },
    { orgIdx: 0, title: 'Spring Awakening 2026',  monthsAgo: 1 },
  ]

  const eventIds: string[] = []
  const ticketTypeMap: Record<string, { ga: string; vip: string; vol: string; rl: string; staff: string }> = {}

  for (let e = 0; e < eventConfigs.length; e++) {
    const cfg = eventConfigs[e]
    const eventId = uuid('dddd0001', e + 1)
    eventIds.push(eventId)

    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - cfg.monthsAgo)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 3)

    const epEmail = `ep${cfg.orgIdx * 2 + 1}@test.local`
    const ownerId = users[epEmail]
    if (!ownerId) { warn(`No owner for event ${cfg.title}`); continue }

    const wsId1 = uuid('eeee0001', e * 10 + 1)
    const wsId2 = uuid('eeee0001', e * 10 + 2)

    const { error } = await supabase.from('platform_events').upsert({
      id: eventId,
      slug: `event-${e + 1}`,
      owner_id: ownerId,
      organization_id: orgIds[cfg.orgIdx],
      title: cfg.title,
      description: `Historical test event for analytics — ${cfg.title}`,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      venue_id: venueIds[cfg.orgIdx],
      status: 'Closed',
      workflow_statuses: [
        { id: wsId1, name: 'Tickets Open', order: 1, description: 'Ticketing opens' },
        { id: wsId2, name: 'Rooms Open', order: 2, description: 'Rooms open' },
      ],
      module_config: {
        ticketing: { enabled: true, required: true, opens_at_status: wsId1, closes_at_status: null },
        volunteering: { enabled: true, required: false, opens_at_status: wsId1, closes_at_status: null },
      },
      cancellation_policy: { checkpoints: [{ status_id: wsId1, refund_percentage: 50 }] },
    }, { onConflict: 'id' })
    if (error) warn(`event ${cfg.title}: ${error.message}`)
    else ok(`event: ${cfg.title} (${startDate.toISOString().split('T')[0]})`)

    // Ticket types per event: GA ($450), VIP ($650), Volunteer ($250), Room Lead ($0), Staff ($0)
    const gaId = uuid('ffff0001', e * 10 + 1)
    const vipId = uuid('ffff0001', e * 10 + 2)
    const volId = uuid('ffff0001', e * 10 + 3)
    const rlId = uuid('ffff0001', e * 10 + 4)
    const staffId = uuid('ffff0001', e * 10 + 5)
    ticketTypeMap[eventId] = { ga: gaId, vip: vipId, vol: volId, rl: rlId, staff: staffId }

    const tts = [
      { id: gaId, event_id: eventId, name: 'General Admission', price: 450, available_count: 100, room_lead: false, volunteer_hours_required: 0 },
      { id: vipId, event_id: eventId, name: 'VIP Pass', price: 650, available_count: 30, room_lead: false, volunteer_hours_required: 0 },
      { id: volId, event_id: eventId, name: 'Volunteer Pass', price: 250, available_count: 20, room_lead: false, volunteer_hours_required: 4 },
      { id: rlId, event_id: eventId, name: 'Room Lead', price: 0, available_count: 15, room_lead: true, roommate_codes_enabled: true, volunteer_hours_required: 0 },
      { id: staffId, event_id: eventId, name: 'Staff Comp', price: 0, available_count: 10, room_lead: false, volunteer_hours_required: 0 },
    ]
    for (const tt of tts) {
      const { error: ttErr } = await supabase.from('ticket_types').upsert(tt, { onConflict: 'id' })
      if (ttErr) warn(`ticket_type ${tt.name} (event ${e + 1}): ${ttErr.message}`)
    }

    // Merchandise per event
    const merchId1 = uuid('aaab0001', e * 10 + 1)
    const merchId2 = uuid('aaab0001', e * 10 + 2)
    await supabase.from('merchandise').upsert([
      { id: merchId1, event_id: eventId, name: 'Event T-Shirt', price: 35, available_count: 100, enabled: true },
      { id: merchId2, event_id: eventId, name: 'Sticker Pack', price: 10, available_count: 200, enabled: true },
    ], { onConflict: 'id' })
  }

  // ── Attendees + Orders for historical events ───────────────────────────────
  section('Accounting Seed — Attendees, orders, and refunds')

  const attendeeEmails = Array.from({ length: 60 }, (_, i) => `attendee${i + 1}@test.local`)
  const refundChannels: (string | null)[] = ['standard', 'standard', 'standard', 'hardship', 'chargeback', null]

  for (let e = 0; e < eventConfigs.length; e++) {
    const eventId = eventIds[e]
    const ttMap = ticketTypeMap[eventId]
    if (!ttMap) continue

    const cfg = eventConfigs[e]
    const eventStart = new Date(now)
    eventStart.setMonth(eventStart.getMonth() - cfg.monthsAgo)

    // 50-65 attendees per event, drawn from the attendee pool with overlap
    const attendeeCount = 50 + Math.floor(Math.random() * 16)
    const startIdx = (e * 7) % 60 // offset so different events overlap partially

    console.log(`\n  Event ${e + 1}: ${cfg.title} — ${attendeeCount} attendees`)

    const ticketDistribution = [
      { typeId: ttMap.ga, typeName: 'GA', count: Math.floor(attendeeCount * 0.55), price: 450 },
      { typeId: ttMap.vip, typeName: 'VIP', count: Math.floor(attendeeCount * 0.18), price: 650 },
      { typeId: ttMap.vol, typeName: 'Vol', count: Math.floor(attendeeCount * 0.12), price: 250 },
      { typeId: ttMap.rl, typeName: 'RL', count: Math.floor(attendeeCount * 0.08), price: 0 },
      { typeId: ttMap.staff, typeName: 'Staff', count: Math.floor(attendeeCount * 0.07), price: 0 },
    ]

    let attendeeIdx = 0
    for (const dist of ticketDistribution) {
      for (let a = 0; a < dist.count; a++) {
        const email = attendeeEmails[(startIdx + attendeeIdx) % 60]
        const userId = users[email]
        if (!userId) { attendeeIdx++; continue }

        const orderId = uuid('1111' + String(e).padStart(4, '0'), attendeeIdx + 1)
        const orderDate = randomDate(
          new Date(eventStart.getTime() - 60 * 86400000),
          new Date(eventStart.getTime() - 5 * 86400000)
        )

        // Determine if this order gets a refund (~10% of paid tickets)
        const isPaid = dist.price > 0
        const isRefund = isPaid && Math.random() < 0.10
        const isCancelled = isPaid && !isRefund && Math.random() < 0.05
        const refundAmount = isRefund ? (Math.random() < 0.5 ? dist.price : dist.price * 0.5) : 0
        const channel = isRefund ? refundChannels[Math.floor(Math.random() * refundChannels.length)] : null

        let orderStatus = 'complete'
        if (isCancelled) orderStatus = 'cancelled'
        else if (isRefund && refundAmount >= dist.price) orderStatus = 'refunded'
        else if (isRefund) orderStatus = 'partial_refund'

        // Insert order
        const { error: orderErr } = await supabase.from('orders').upsert({
          id: orderId,
          event_id: eventId,
          user_id: userId,
          payment_provider: cfg.orgIdx === 0 ? 'square' : 'paypal',
          payment_transaction_id: `txn_${orderId.slice(0, 8)}`,
          status: orderStatus,
          subtotal: dist.price,
          amount_refunded: parseFloat(refundAmount.toFixed(2)),
          refund_channel: channel,
          completed_at: orderDate.toISOString(),
        }, { onConflict: 'id' })
        if (orderErr) { warn(`order: ${orderErr.message}`); attendeeIdx++; continue }

        // Insert order_items (ticket)
        await supabase.from('order_items').upsert({
          id: uuid('2222' + String(e).padStart(4, '0'), attendeeIdx + 1),
          order_id: orderId,
          item_type: 'ticket',
          item_id: dist.typeId,
          quantity: 1,
          unit_price: dist.price,
          amount_refunded: parseFloat(refundAmount.toFixed(2)),
        }, { onConflict: 'id' })

        // Merchandise purchase (~40% of paid attendees)
        if (isPaid && Math.random() < 0.4) {
          const merchItemId = uuid('aaab0001', e * 10 + (Math.random() < 0.7 ? 1 : 2))
          const merchPrice = merchItemId.endsWith('1') ? 35 : 10
          await supabase.from('order_items').upsert({
            id: uuid('3333' + String(e).padStart(4, '0'), attendeeIdx + 1),
            order_id: orderId,
            item_type: 'merchandise',
            item_id: merchItemId,
            quantity: 1,
            unit_price: merchPrice,
            amount_refunded: 0,
          }, { onConflict: 'id' })
        }

        // Event attendee record
        const ticketStatus = isCancelled ? 'Incomplete' : 'Complete'
        const lockStatus = !isCancelled && !isRefund ? 'Locked' : 'Unlocked'
        await supabase.from('event_attendees').upsert({
          id: uuid('4444' + String(e).padStart(4, '0'), attendeeIdx + 1),
          event_id: eventId,
          user_id: userId,
          ticket_type_id: dist.typeId,
          ticket_purchased_at: orderDate.toISOString(),
          order_id: orderId,
          application_status: 'Approved',
          ticket_status: ticketStatus,
          lock_status: lockStatus,
          is_room_lead: dist.typeName === 'RL',
          volunteer_hours_required: dist.typeName === 'Vol' ? 4 : 0,
        }, { onConflict: 'event_id,user_id' })

        attendeeIdx++
      }
    }
    ok(`Event ${e + 1}: ${attendeeIdx} attendees seeded`)
  }

  // ── Active event with ALL modules ──────────────────────────────────────────
  section('Accounting Seed — Active event (all modules)')

  const activeEventId = uuid('dddd0001', 99)
  const activeWs1 = uuid('eeee0099', 1)
  const activeWs2 = uuid('eeee0099', 2)
  const activeWs3 = uuid('eeee0099', 3)

  const activeTtGa = uuid('ffff0099', 1)
  const activeTtVip = uuid('ffff0099', 2)
  const activeTtVol = uuid('ffff0099', 3)
  const activeTtRl = uuid('ffff0099', 4)

  const activeStart = new Date(now)
  activeStart.setMonth(activeStart.getMonth() + 2)
  const activeEnd = new Date(activeStart)
  activeEnd.setDate(activeEnd.getDate() + 4)

  const activeOwnerId = users['ep1@test.local']!
  const { error: activeErr } = await supabase.from('platform_events').upsert({
    id: activeEventId,
    slug: 'upcoming-gala-2026',
    owner_id: activeOwnerId,
    organization_id: orgIds[0],
    title: 'Upcoming Gala 2026',
    description: 'Active event with all modules enabled — first custom status',
    start_date: activeStart.toISOString().split('T')[0],
    end_date: activeEnd.toISOString().split('T')[0],
    venue_id: venueIds[0],
    status: 'Applications Open',
    workflow_statuses: [
      { id: activeWs1, name: 'Applications Open', order: 1, description: 'Applications open' },
      { id: activeWs2, name: 'Tickets Open', order: 2, description: 'Tickets open' },
      { id: activeWs3, name: 'Rooms Open', order: 3, description: 'Rooms open' },
    ],
    module_config: {
      application: { enabled: true, required: true, opens_at_status: activeWs1, closes_at_status: activeWs2 },
      ticketing: { enabled: true, required: true, opens_at_status: activeWs2, closes_at_status: null },
      waiver: { enabled: true, required: true, opens_at_status: activeWs2, closes_at_status: null },
      venue: { enabled: true, required: false, opens_at_status: activeWs3, closes_at_status: null },
      volunteering: { enabled: true, required: false, opens_at_status: activeWs2, closes_at_status: null },
      schedule: { enabled: true, required: false, opens_at_status: 'Published', closes_at_status: null },
      badge: { enabled: true, required: false, opens_at_status: activeWs2, closes_at_status: null },
    },
    cancellation_policy: {
      checkpoints: [
        { status_id: activeWs1, refund_percentage: 100 },
        { status_id: activeWs2, refund_percentage: 50 },
      ],
    },
    room_lock_in_date: new Date(activeStart.getTime() - 14 * 86400000).toISOString(),
  }, { onConflict: 'id' })
  if (activeErr) warn(`active event: ${activeErr.message}`)
  else ok('Active event: Upcoming Gala 2026 (status: Applications Open)')

  // Ticket types for active event
  const activeTts = [
    { id: activeTtGa, event_id: activeEventId, name: 'General Admission', price: 500, available_count: 150, room_lead: false, volunteer_hours_required: 0 },
    { id: activeTtVip, event_id: activeEventId, name: 'VIP Experience', price: 750, available_count: 40, room_lead: false, volunteer_hours_required: 0 },
    { id: activeTtVol, event_id: activeEventId, name: 'Volunteer Pass', price: 300, available_count: 25, room_lead: false, volunteer_hours_required: 4 },
    { id: activeTtRl, event_id: activeEventId, name: 'Room Lead', price: 0, available_count: 20, room_lead: true, roommate_codes_enabled: true, volunteer_hours_required: 0 },
  ]
  for (const tt of activeTts) {
    const { error: ttErr } = await supabase.from('ticket_types').upsert(tt, { onConflict: 'id' })
    if (ttErr) warn(`active ticket_type ${tt.name}: ${ttErr.message}`)
    else ok(`active ticket_type: ${tt.name} ($${tt.price})`)
  }

  // Application form for active event
  const activeFormId = uuid('aaac0001', 1)
  await supabase.from('application_forms').upsert({
    id: activeFormId,
    event_id: activeEventId,
    title: 'Upcoming Gala Application',
    fields: [
      { id: uuid('aaac0002', 1), type: 'text', label: 'Preferred scene name?', options: [], required: true, order: 1 },
      { id: uuid('aaac0002', 2), type: 'radio', label: 'How did you hear about us?', options: ['Friend', 'Social Media', 'Website'], required: true, order: 2 },
    ],
  }, { onConflict: 'id' })
  ok('Application form for active event')

  // Volunteer shifts for active event
  for (let s = 0; s < 4; s++) {
    const shiftDate = new Date(activeStart)
    shiftDate.setDate(shiftDate.getDate() + Math.floor(s / 2))
    shiftDate.setHours(10 + (s % 2) * 4)
    await supabase.from('volunteer_shifts').upsert({
      id: uuid('aaad0001', s + 1),
      event_id: activeEventId,
      name: `Shift ${s + 1} — ${s % 2 === 0 ? 'Morning' : 'Afternoon'}`,
      date_time: shiftDate.toISOString(),
      duration_minutes: 120,
      capacity: 5,
    }, { onConflict: 'id' })
  }
  ok('4 volunteer shifts for active event')

  ok('Accounting seed complete!')
}

async function main() {
  console.log('\n========================================================')
  console.log('  Lekd Platform — Development Seed Script')
  console.log('========================================================')
  console.log(`  Supabase URL: ${supabaseUrl}`)
  console.log(`  Test user DOB: ${dob} (30 years ago)`)
  console.log('\n  WARNING: Development only. NEVER run against production.')
  console.log('\n  admin@test.local / Admin1234! is always created.\n')

  const doAccountingSeed = await ask('Run Accounting Seed? (truncates all, creates orgs + historical events + sales data)')

  if (doAccountingSeed) {
    await accountingSeed()
    console.log('\n========================================================')
    console.log('  Accounting Seed complete.')
    console.log('  admin@test.local  / Admin1234!  (System Administrator)')
    console.log('  ol1@test.local    / OrgLead1!   (Org Lead — Shiny Dog)')
    console.log('  ep1@test.local    / EventPro1!  (EP — Shiny Dog)')
    console.log('  ml1@test.local    / ModLead1!   (ML — Shiny Dog)')
    console.log('')
    console.log('  3 organizations, 10 historical events, 1 active event')
    console.log('  ~550 attendee records with paid orders and refunds')
    console.log('========================================================\n')
    rl.close()
    return
  }

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
