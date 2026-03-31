import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildHotelWeeklyWorkbook, HotelWeeklyRow } from '@/lib/excel'
import { generatePDFFromHTML } from '@/lib/pdf'
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

interface AttendeeRow {
  user_id: string
  room_id: string | null
  lock_status: string
  rooms: {
    number: string
    name: string
    lodging_type: string | null
    room_code: string | null
    room_daily_rates: unknown
  } | null
  platform_users: {
    preferred_scene_name: string | null
    email: string
  } | null
}

interface EventRow {
  id: string
  title: string
  status: string
  hotel_contact_email: string | null
  start_date: string
  end_date: string
  venue_id: string | null
  venues: { email: string | null } | null
}

interface Snapshot {
  [roomId: string]: string // roomId → guestSceneName
}

function buildHtmlReport(
  eventTitle: string,
  rows: HotelWeeklyRow[],
  changedRoomIds: Set<string>
): string {
  const rowsHtml = rows
    .map((r) => {
      const highlight = changedRoomIds.has(r.roomId) ? ' style="background:#ffff00"' : ''
      return `<tr${highlight}>
        <td>${r.roomNumber}</td>
        <td>${r.roomName}</td>
        <td>${r.roomType ?? ''}</td>
        <td>${r.roomCode ?? ''}</td>
        <td>${r.guestSceneName}</td>
        <td>${r.checkIn ?? ''}</td>
        <td>${r.checkOut ?? ''}</td>
        <td>${r.lockStatus}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #d9d9d9; font-weight: bold; }
    </style>
  </head><body>
    <h2>${eventTitle} — Hotel Room List</h2>
    <table>
      <thead><tr>
        <th>Room #</th><th>Room Name</th><th>Room Type</th><th>Room Code</th>
        <th>Guest Scene Name</th><th>Check-in</th><th>Check-out</th><th>Lock Status</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body></html>`
}

async function processEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: EventRow,
  errors: string[]
): Promise<boolean> {
  const contactEmail = event.hotel_contact_email ?? event.venues?.email ?? null
  if (!contactEmail) {
    errors.push(`Event ${event.id}: no hotel contact email configured — skipping`)
    return false
  }

  // Fetch locked attendees with their room info
  const { data: attendees, error: attendeesError } = await admin
    .from('event_attendees')
    .select(`
      user_id,
      room_id,
      lock_status,
      rooms ( number, name, lodging_type, room_code, room_daily_rates ),
      platform_users ( preferred_scene_name, email )
    `)
    .eq('event_id', event.id)
    .eq('lock_status', 'Locked')

  if (attendeesError) {
    errors.push(`Event ${event.id}: attendee query failed — ${attendeesError.message}`)
    return false
  }

  const rows: HotelWeeklyRow[] = (attendees ?? []).map((a: any) => {
    const displayName = a.platform_users?.preferred_scene_name?.trim()
      || (a.platform_users?.email?.split('@')[0] ?? 'Unknown')
    return {
      roomId: a.room_id ?? '',
      roomNumber: a.rooms?.number ?? '',
      roomName: a.rooms?.name ?? '',
      roomType: a.rooms?.lodging_type ?? null,
      roomCode: a.rooms?.room_code ?? null,
      guestSceneName: displayName,
      checkIn: event.start_date,
      checkOut: event.end_date,
      lockStatus: a.lock_status,
    }
  })

  // Load previous snapshot from Supabase Storage
  const snapshotPath = `hotel-weekly/${event.id}/last.json`
  let previousSnapshot: Snapshot = {}
  try {
    const { data: snapshotFile } = await admin.storage
      .from('reports')
      .download(snapshotPath)
    if (snapshotFile) {
      const text = await snapshotFile.text()
      previousSnapshot = JSON.parse(text)
    }
  } catch {
    // No previous snapshot — first run
  }

  // Diff to find changed rooms
  const currentSnapshot: Snapshot = {}
  const changedRoomIds = new Set<string>()
  for (const r of rows) {
    if (!r.roomId) continue
    currentSnapshot[r.roomId] = r.guestSceneName
    if (previousSnapshot[r.roomId] !== r.guestSceneName) {
      changedRoomIds.add(r.roomId)
    }
  }
  // Also flag rooms that were in previous snapshot but are now gone
  for (const roomId of Object.keys(previousSnapshot)) {
    if (!currentSnapshot[roomId]) {
      changedRoomIds.add(roomId)
    }
  }

  // Build email body
  let emailBody: string
  if (changedRoomIds.size === 0) {
    emailBody = '<p>No changes from last week.</p>'
  } else {
    const changedRoomNames = rows
      .filter((r) => changedRoomIds.has(r.roomId))
      .map((r) => `<li>Room ${r.roomNumber} — ${r.roomName}: ${r.guestSceneName}</li>`)
      .join('')
    emailBody = `<p>Changes since last week:</p><ul>${changedRoomNames}</ul>`
  }

  // Generate Excel
  let excelBuffer: Buffer
  try {
    excelBuffer = await buildHotelWeeklyWorkbook(rows, changedRoomIds)
  } catch (err) {
    errors.push(`Event ${event.id}: Excel generation failed — ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  // Generate PDF
  let pdfBuffer: Buffer
  try {
    const html = buildHtmlReport(event.title, rows, changedRoomIds)
    pdfBuffer = await generatePDFFromHTML(html)
  } catch (err) {
    errors.push(`Event ${event.id}: PDF generation failed — ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  // Send email with both attachments
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@shinydog.events'
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const emailResult = await sendEmail({
    To: contactEmail,
    From: fromEmail,
    Subject: `${event.title} — Weekly Hotel Room Report (${dateStr})`,
    HtmlBody: `<h2>${event.title} — Weekly Hotel Room Report</h2>${emailBody}`,
    TextBody: emailBody.replace(/<[^>]+>/g, ''),
    Attachments: [
      {
        Name: `hotel-report-${event.id}.xlsx`,
        Content: excelBuffer.toString('base64'),
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ContentID: null,
      },
      {
        Name: `hotel-report-${event.id}.pdf`,
        Content: pdfBuffer.toString('base64'),
        ContentType: 'application/pdf',
        ContentID: null,
      },
    ],
  })

  if (!emailResult.success) {
    errors.push(`Event ${event.id}: email send failed — ${emailResult.error}`)
    return false
  }

  // Save current snapshot
  const snapshotJson = JSON.stringify(currentSnapshot)
  await admin.storage
    .from('reports')
    .upload(snapshotPath, snapshotJson, {
      contentType: 'application/json',
      upsert: true,
    })

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
      .select('id, title, status, hotel_contact_email, start_date, end_date, venue_id, venues ( email )')
      .eq('id', eventIdParam)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    events = [data as unknown as EventRow]
  } else {
    const { data, error } = await admin
      .from('platform_events')
      .select('id, title, status, hotel_contact_email, start_date, end_date, venue_id, venues ( email )')
      .not('status', 'in', '("Draft","Archived")')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Only include events that have a hotel contact email somewhere
    events = ((data ?? []) as unknown as EventRow[]).filter(
      (e) => e.hotel_contact_email || e.venues?.email
    )
  }

  const errors: string[] = []
  let processed = 0

  for (const event of events) {
    const ok = await processEvent(admin, event, errors)
    if (ok) processed++
  }

  return NextResponse.json({ processed, errors })
}
