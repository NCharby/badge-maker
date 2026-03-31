import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildOfflinePacketWorkbook,
  AttendeeRoomRow,
  RoomLockIssueRow,
  VolunteerScheduleRow,
  EventScheduleRow,
} from '@/lib/excel'
import { sendEmail } from '@/lib/email'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.SCHEDULER_SECRET
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

interface EventRow {
  id: string
  title: string
  start_date: string
  end_date: string
  owner_id: string
  platform_users: { email: string } | null
}

async function processEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: EventRow,
  errors: string[]
): Promise<boolean> {
  const epEmail = event.platform_users?.email
  if (!epEmail) {
    errors.push(`Event ${event.id}: EP email not found — skipping`)
    return false
  }

  // ── Tab 1: Attendee Room List (locked attendees) ──
  const { data: lockedAttendees } = await admin
    .from('event_attendees')
    .select(`
      lock_status,
      room_id,
      platform_users ( preferred_scene_name, email ),
      rooms ( number, name, lodging_type, room_code )
    `)
    .eq('event_id', event.id)
    .eq('lock_status', 'Locked')

  const attendeeRoomList: AttendeeRoomRow[] = (lockedAttendees ?? []).map((a: any) => ({
    sceneName: a.platform_users?.preferred_scene_name?.trim()
      || (a.platform_users?.email?.split('@')[0] ?? 'Unknown'),
    roomNumber: a.rooms?.number ?? '',
    roomType: a.rooms?.lodging_type ?? null,
    roomCode: a.rooms?.room_code ?? null,
    checkIn: event.start_date,
    checkOut: event.end_date,
  }))

  // ── Tab 2: Room Lock Status ──
  // Room Lock Issue Report: ticket complete but not locked
  const { data: issueAttendees } = await admin
    .from('event_attendees')
    .select(`
      lock_status,
      ticket_type_id,
      ticket_types ( name ),
      platform_users ( preferred_scene_name, email )
    `)
    .eq('event_id', event.id)
    .eq('ticket_status', 'Complete')
    .not('lock_status', 'eq', 'Locked')

  const roomLockIssues: RoomLockIssueRow[] = (issueAttendees ?? []).map((a: any) => ({
    sceneName: a.platform_users?.preferred_scene_name?.trim()
      || (a.platform_users?.email?.split('@')[0] ?? 'Unknown'),
    email: a.platform_users?.email ?? '',
    ticketType: (a.ticket_types as any)?.name ?? null,
    lockStatus: a.lock_status,
  }))

  // Room Lock Change Report: query is not possible without a change-log table;
  // stub with an empty array — EP can view changes in the Supabase dashboard
  const roomLockChanges: never[] = []

  // ── Tab 3: Volunteer Schedule ──
  const { data: shifts } = await admin
    .from('volunteer_shifts')
    .select(`
      name,
      date_time,
      duration_minutes,
      capacity,
      user_volunteer_signups ( status, platform_users ( preferred_scene_name, email ) )
    `)
    .eq('event_id', event.id)

  const volunteerSchedule: VolunteerScheduleRow[] = (shifts ?? []).map((s: any) => {
    const confirmedVolunteers = (s.user_volunteer_signups ?? [])
      .filter((su: any) => su.status === 'confirmed')
      .map((su: any) => {
        const u = su.platform_users
        return u?.preferred_scene_name?.trim() || (u?.email?.split('@')[0] ?? 'Unknown')
      })
      .join(', ')
    return {
      shiftName: s.name,
      dateTime: s.date_time,
      durationMinutes: s.duration_minutes,
      capacity: s.capacity,
      volunteers: confirmedVolunteers || '(none confirmed)',
    }
  })

  // ── Tab 4: Event Schedule ──
  const { data: activities } = await admin
    .from('schedule_activities')
    .select('name, date_time, duration_minutes, description, volunteers_requested, volunteer_count')
    .eq('event_id', event.id)

  const eventSchedule: EventScheduleRow[] = (activities ?? []).map((a: any) => ({
    activityName: a.name,
    dateTime: a.date_time,
    durationMinutes: a.duration_minutes,
    description: a.description ?? '',
    volunteersRequested: a.volunteers_requested ? (a.volunteer_count ?? 0) : null,
  }))

  // Build workbook
  let xlsxBuffer: Buffer
  try {
    xlsxBuffer = await buildOfflinePacketWorkbook({
      attendeeRoomList,
      roomLockIssues,
      roomLockChanges,
      volunteerSchedule,
      eventSchedule,
    })
  } catch (err) {
    errors.push(`Event ${event.id}: Excel generation failed — ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  // Email to EP
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@shinydog.events'
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `offline-packet-${event.id}-${timestamp}.xlsx`

  const emailResult = await sendEmail({
    To: epEmail,
    From: fromEmail,
    Subject: `${event.title} — Offline Reporting Packet`,
    HtmlBody: `<h2>${event.title} — Offline Reporting Packet</h2>
      <p>Generated: ${dateStr}</p>
      <p>Attached is the offline reporting packet for <strong>${event.title}</strong>.
      This Excel workbook contains:</p>
      <ul>
        <li>Attendee Room List (Tab 1)</li>
        <li>Room Lock Status (Tab 2)</li>
        <li>Volunteer Schedule (Tab 3)</li>
        <li>Event Schedule (Tab 4)</li>
      </ul>
      <p>Please save this file as a backup in case internet access is unavailable at the event.</p>`,
    TextBody: `${event.title} — Offline Reporting Packet\nGenerated: ${dateStr}\n\nSee attached Excel workbook.`,
    Attachments: [
      {
        Name: fileName,
        Content: xlsxBuffer.toString('base64'),
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ContentID: null,
      },
    ],
  })

  if (!emailResult.success) {
    errors.push(`Event ${event.id}: email send failed — ${emailResult.error}`)
    return false
  }

  // Upload to Supabase Storage for re-download
  const storagePath = `offline-packet/${event.id}/${timestamp}.xlsx`
  await admin.storage.from('reports').upload(storagePath, xlsxBuffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: false,
  })

  // Reset the flag
  await admin
    .from('platform_events')
    .update({ pending_offline_report: false })
    .eq('id', event.id)

  return true
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const eventIdParam = searchParams.get('event_id')

  let events: EventRow[]

  if (eventIdParam) {
    const { data, error } = await admin
      .from('platform_events')
      .select('id, title, start_date, end_date, owner_id, platform_users ( email )')
      .eq('id', eventIdParam)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    events = [data as unknown as EventRow]
  } else {
    const { data, error } = await admin
      .from('platform_events')
      .select('id, title, start_date, end_date, owner_id, platform_users ( email )')
      .eq('pending_offline_report', true)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    events = (data ?? []) as unknown as EventRow[]
  }

  const errors: string[] = []
  let processed = 0

  for (const event of events) {
    const ok = await processEvent(admin, event, errors)
    if (ok) processed++
  }

  return NextResponse.json({ processed, errors })
}
