import { epEventGuard } from '@/lib/auth/ep-guard'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LockCheckClient, { type LockCheckRow, type RequiredModule } from './LockCheckClient'

const REQUIRED_MODULE_LABELS: Record<string, string> = {
  application:    'Application',
  ticketing:      'Ticket',
  waiver:         'Waiver',
  room_selection: 'Room Selection',
  venue:          'Room Selection',
  volunteering:   'Volunteering',
}

export default async function LockCheckPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return null

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, status, module_config')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  const moduleConfig = (event.module_config ?? {}) as Record<string, {
    enabled?: boolean
    required?: boolean
  } | undefined>

  // Derive required modules (excluding venue — treated same as room_selection in the label)
  const requiredModuleKeys = Object.entries(moduleConfig)
    .filter(([, cfg]) => cfg?.enabled && cfg?.required)
    .map(([key]) => key)

  // De-dupe venue/room_selection (they're mutually exclusive but label the same)
  const seenLabels = new Set<string>()
  const requiredModules: RequiredModule[] = []
  for (const key of requiredModuleKeys) {
    const label = REQUIRED_MODULE_LABELS[key] ?? key
    if (!seenLabels.has(label)) {
      seenLabels.add(label)
      requiredModules.push({ key, label })
    }
  }

  // Fetch all attendees with module statuses
  const { data: attendees } = await admin
    .from('event_attendees')
    .select(`
      user_id, application_status, waiver_status, ticket_status,
      room_status, lock_status, volunteer_hours_required,
      platform_users!inner(id, email, preferred_scene_name)
    `)
    .eq('event_id', eventId)

  // Fetch confirmed volunteer signups
  const { data: signups } = await admin
    .from('user_volunteer_signups')
    .select('user_id, shift_id')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  const shiftIds = Array.from(new Set((signups ?? []).map(s => s.shift_id)))
  let shiftMinutesMap: Record<string, number> = {}
  if (shiftIds.length > 0) {
    const { data: shifts } = await admin
      .from('volunteer_shifts')
      .select('id, duration_minutes')
      .in('id', shiftIds)
    for (const shift of shifts ?? []) {
      shiftMinutesMap[shift.id] = shift.duration_minutes
    }
  }
  const confirmedByUser: Record<string, number> = {}
  for (const s of signups ?? []) {
    confirmedByUser[s.user_id] = (confirmedByUser[s.user_id] ?? 0) + (shiftMinutesMap[s.shift_id] ?? 0)
  }

  // Build rows
  const rows: LockCheckRow[] = (attendees ?? []).map(row => {
    const pu = Array.isArray(row.platform_users) ? row.platform_users[0] : row.platform_users
    const displayName = pu?.preferred_scene_name || pu?.email?.split('@')[0] || 'Unknown'

    const incompleteModules: string[] = []
    const completedModules: string[] = []

    for (const { key, label } of requiredModules) {
      let complete = false
      if (key === 'application') complete = row.application_status === 'Approved'
      else if (key === 'ticketing') complete = row.ticket_status === 'Complete'
      else if (key === 'waiver') complete = row.waiver_status === 'Completed'
      else if (key === 'room_selection' || key === 'venue') complete = row.room_status === 'Locked In' || row.room_status === 'Verified'
      else if (key === 'volunteering') {
        const req = row.volunteer_hours_required ?? 0
        complete = req === 0 || (confirmedByUser[row.user_id] ?? 0) >= req * 60
      }
      if (complete) completedModules.push(label)
      else incompleteModules.push(label)
    }

    return {
      userId: row.user_id,
      displayName,
      lockStatus: row.lock_status,
      incompleteModules,
      completedModules,
    }
  })

  // Sort: incomplete first, then by displayName
  rows.sort((a, b) => {
    if (a.incompleteModules.length !== b.incompleteModules.length) {
      return b.incompleteModules.length - a.incompleteModules.length
    }
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
          Event Lock Check
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          Review which attendees have incomplete required modules. Send notifications to prompt them to complete their steps.
        </p>
      </div>

      <LockCheckClient
        eventId={eventId}
        eventTitle={event.title}
        requiredModules={requiredModules}
        rows={rows}
      />
    </div>
  )
}
