'use server'

import { revalidatePath } from 'next/cache'
import type { WorkflowStatus } from '@/types/platform'
import { sendEventChannelMessage } from '@/lib/telegram/send'
import { epEventGuard } from '@/lib/auth/ep-guard'

const SYSTEM_STATUSES = ['Draft', 'Published', 'Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

export async function updateEventStatus(
  eventId: string,
  newStatus: string,
): Promise<{ success: true } | { error: string }> {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Access denied.' }

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, start_date, workflow_statuses, module_config')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found.' }

  const customNames = ((event.workflow_statuses ?? []) as WorkflowStatus[]).map(s => s.name)
  if (!SYSTEM_STATUSES.includes(newStatus) && !customNames.includes(newStatus)) {
    return { error: 'Invalid status.' }
  }

  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'Event Locked') {
    updatePayload.pending_offline_report = true
  }

  const { error } = await admin
    .from('platform_events')
    .update(updatePayload)
    .eq('id', eventId)
  if (error) return { error: error.message }

  // Find custom status message for any module that opens at this status
  const workflowStatuses = ((event.workflow_statuses ?? []) as WorkflowStatus[])
  const moduleConfig = (event.module_config ?? {}) as Record<string, {
    enabled?: boolean
    opens_at_status?: string | null
    custom_status_message_enabled?: boolean
    custom_status_message?: string
  } | undefined>
  let statusMessage = ''
  for (const cfg of Object.values(moduleConfig)) {
    if (!cfg?.enabled || !cfg.opens_at_status || !cfg.custom_status_message_enabled || !cfg.custom_status_message) continue
    // opens_at_status may be a UUID (custom status) or a system status name like 'Published'
    const resolvedName = workflowStatuses.find(s => s.id === cfg.opens_at_status)?.name ?? cfg.opens_at_status
    if (resolvedName === newStatus) {
      statusMessage = cfg.custom_status_message
      break
    }
  }

  // Event-specific channel notifications
  sendEventChannelMessage(eventId, 'status_transition', { new_status: newStatus, event_name: event.title ?? '', status_message: statusMessage })
    .then(r => { if (!r.success) console.error('[telegram] status_transition failed:', r.error) })
  if (newStatus === 'Event Locked') {
    const eventDate = event.start_date
      ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : ''
    sendEventChannelMessage(eventId, 'event_locked', { event_name: event.title ?? '', event_date: eventDate })
      .then(r => { if (!r.success) console.error('[telegram] event_locked failed:', r.error) })
  }
  // rooms_open: fire when the new status matches the opens_at_status of room_selection or venue module
  const roomModuleCfg = moduleConfig['room_selection'] ?? moduleConfig['venue']
  if (roomModuleCfg?.enabled && roomModuleCfg?.opens_at_status === newStatus) {
    sendEventChannelMessage(eventId, 'rooms_open', { event_name: event.title ?? '' })
      .then(r => { if (!r.success) console.error('[telegram] rooms_open failed:', r.error) })
  }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath('/ep/dashboard')
  // Invalidate the entire user-facing event subtree so all module pages (application,
  // ticket, volunteer, schedule, rooms, etc.) immediately reflect the new status.
  revalidatePath(`/events/${eventId}`, 'layout')
  return { success: true }
}
