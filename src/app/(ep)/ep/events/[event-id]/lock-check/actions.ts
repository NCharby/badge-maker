'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { epEventGuard } from '@/lib/auth/ep-guard'

const REQUIRED_MODULE_LABELS: Record<string, string> = {
  application:    'Application',
  ticketing:      'Ticket',
  waiver:         'Waiver',
  room_selection: 'Room Selection',
  venue:          'Room Selection',
  volunteering:   'Volunteering',
}

export async function notifyIncomplete(
  eventId: string,
  userId: string | null,
): Promise<{ success: true; count: number } | { error: string }> {
  const { authorized } = await epEventGuard(eventId)
  if (!authorized) return { error: 'Access denied.' }

  const admin = createAdminClient()

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, module_config')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found.' }

  // Determine required modules
  const moduleConfig = (event.module_config ?? {}) as Record<string, {
    enabled?: boolean
    required?: boolean
  } | undefined>

  const requiredModuleKeys = Object.entries(moduleConfig)
    .filter(([, cfg]) => cfg?.enabled && cfg?.required)
    .map(([key]) => key)

  if (requiredModuleKeys.length === 0) {
    return { success: true, count: 0 }
  }

  // Fetch attendees
  let query = admin
    .from('event_attendees')
    .select(`
      user_id, application_status, waiver_status, ticket_status,
      room_status, lock_status, volunteer_hours_required,
      platform_users!inner(id, email, preferred_scene_name)
    `)
    .eq('event_id', eventId)
    .neq('lock_status', 'Locked')

  if (userId) {
    query = query.eq('user_id', userId) as typeof query
  }

  const { data: attendees, error: fetchErr } = await query
  if (fetchErr) return { error: fetchErr.message }

  // Fetch confirmed volunteer minutes per attendee
  const { data: signups } = await admin
    .from('user_volunteer_signups')
    .select('user_id, shift_id')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  const shiftIds = Array.from(new Set((signups ?? []).map(s => s.shift_id)))
  let shiftMinutes: Record<string, number> = {}
  if (shiftIds.length > 0) {
    const { data: shifts } = await admin
      .from('volunteer_shifts')
      .select('id, duration_minutes')
      .in('id', shiftIds)
    for (const shift of shifts ?? []) {
      shiftMinutes[shift.id] = shift.duration_minutes
    }
  }
  const confirmedMinutesByUser: Record<string, number> = {}
  for (const signup of signups ?? []) {
    confirmedMinutesByUser[signup.user_id] = (confirmedMinutesByUser[signup.user_id] ?? 0) + (shiftMinutes[signup.shift_id] ?? 0)
  }

  let count = 0

  for (const row of attendees ?? []) {
    const incompleteLabels: string[] = []
    for (const key of requiredModuleKeys) {
      let complete = false
      if (key === 'application') complete = row.application_status === 'Approved'
      else if (key === 'ticketing') complete = row.ticket_status === 'Complete'
      else if (key === 'waiver') complete = row.waiver_status === 'Completed'
      else if (key === 'room_selection' || key === 'venue') complete = row.room_status === 'Locked In' || row.room_status === 'Verified'
      else if (key === 'volunteering') {
        const req = row.volunteer_hours_required ?? 0
        complete = req === 0 || (confirmedMinutesByUser[row.user_id] ?? 0) >= req * 60
      }
      if (!complete) incompleteLabels.push(REQUIRED_MODULE_LABELS[key] ?? key)
    }

    if (incompleteLabels.length === 0) continue

    const pu = Array.isArray(row.platform_users) ? row.platform_users[0] : row.platform_users
    const displayName = pu?.preferred_scene_name || pu?.email?.split('@')[0] || 'Attendee'
    const body = `You have incomplete required steps for ${event.title}: ${incompleteLabels.join(', ')}.`

    void createInPlatformNotification({
      userId: row.user_id,
      type: 'lock_check_reminder',
      title: `Action required: complete your steps for ${event.title}`,
      body,
      actionUrl: `/events/${eventId}`,
      actionLabel: 'Go to event hub',
      eventId,
    })
    count++
    void displayName // suppress unused warning
  }

  return { success: true, count }
}
