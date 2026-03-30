'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowStatus } from '@/types/platform'

const SYSTEM_STATUSES = ['Draft', 'Published', 'Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

export async function updateEventStatus(
  eventId: string,
  newStatus: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, workflow_statuses')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  if (!event) return { error: 'Access denied.' }

  const customNames = ((event.workflow_statuses ?? []) as WorkflowStatus[]).map(s => s.name)
  if (!SYSTEM_STATUSES.includes(newStatus) && !customNames.includes(newStatus)) {
    return { error: 'Invalid status.' }
  }

  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'Event Locked') {
    updatePayload.pending_offline_report = true
  }

  const { error } = await supabase
    .from('platform_events')
    .update(updatePayload)
    .eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath('/ep/dashboard')
  // Invalidate the entire user-facing event subtree so all module pages (application,
  // ticket, volunteer, schedule, rooms, etc.) immediately reflect the new status.
  revalidatePath(`/events/${eventId}`, 'layout')
  return { success: true }
}
