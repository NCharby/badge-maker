'use server'

import { revalidatePath } from 'next/cache'
import type { WorkflowStatus } from '@/types/platform'
import { epEventGuard } from '@/lib/auth/ep-guard'

function revalidateAll(eventId: string) {
  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/workflow`)
}

async function fetchEventWithStatuses(eventId: string) {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Access denied.' as const, admin: null, event: null }

  const { data: event } = await admin
    .from('platform_events')
    .select('id, workflow_statuses, module_config, cancellation_policy')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Event not found.' as const, admin, event: null }
  return { error: null, admin, event }
}

function isStatusReferenced(
  statusId: string,
  moduleConfig: Record<string, { opens_at_status?: string; closes_at_status?: string | null } | undefined>,
  cancellationPolicy: { checkpoints?: { status_id: string }[] } | null,
): boolean {
  for (const cfg of Object.values(moduleConfig)) {
    if (!cfg) continue
    if (cfg.opens_at_status === statusId) return true
    if (cfg.closes_at_status === statusId) return true
  }
  for (const checkpoint of cancellationPolicy?.checkpoints ?? []) {
    if (checkpoint.status_id === statusId) return true
  }
  return false
}

export async function addWorkflowStatus(
  eventId: string,
  name: string,
  description: string,
): Promise<{ success: true; newStatus: WorkflowStatus } | { error: string }> {
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Status name is required.' }

  const { error, admin, event } = await fetchEventWithStatuses(eventId)
  if (error || !event) return { error: error ?? 'Not found.' }

  const existing = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order), 0)

  const newStatus: WorkflowStatus = {
    id: crypto.randomUUID(),
    name: trimmedName,
    order: maxOrder + 1,
    description: description.trim(),
  }

  const { error: updateError } = await admin!
    .from('platform_events')
    .update({ workflow_statuses: [...existing, newStatus] })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  revalidateAll(eventId)
  return { success: true, newStatus }
}

export async function renameWorkflowStatus(
  eventId: string,
  statusId: string,
  newName: string,
): Promise<{ success: true; hasRefs: boolean } | { error: string }> {
  const trimmedName = newName.trim()
  if (!trimmedName) return { error: 'Status name is required.' }

  const { error, admin, event } = await fetchEventWithStatuses(eventId)
  if (error || !event) return { error: error ?? 'Not found.' }

  const statuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const idx = statuses.findIndex(s => s.id === statusId)
  if (idx === -1) return { error: 'Status not found.' }

  const updated = statuses.map(s => s.id === statusId ? { ...s, name: trimmedName } : s)

  const { error: updateError } = await admin!
    .from('platform_events')
    .update({ workflow_statuses: updated })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  const hasRefs = isStatusReferenced(
    statusId,
    (event.module_config ?? {}) as Record<string, { opens_at_status?: string; closes_at_status?: string | null }>,
    event.cancellation_policy as { checkpoints?: { status_id: string }[] } | null,
  )

  revalidateAll(eventId)
  return { success: true, hasRefs }
}

export async function deleteWorkflowStatus(
  eventId: string,
  statusId: string,
): Promise<{ success: true } | { error: string }> {
  const { error, admin, event } = await fetchEventWithStatuses(eventId)
  if (error || !event) return { error: error ?? 'Not found.' }

  const hasRefs = isStatusReferenced(
    statusId,
    (event.module_config ?? {}) as Record<string, { opens_at_status?: string; closes_at_status?: string | null }>,
    event.cancellation_policy as { checkpoints?: { status_id: string }[] } | null,
  )
  if (hasRefs) {
    return { error: 'This status is used by module configuration or cancellation policy. Remove those references before deleting.' }
  }

  const statuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const filtered = statuses.filter(s => s.id !== statusId)
  const reindexed = filtered.map((s, i) => ({ ...s, order: i + 1 }))

  const { error: updateError } = await admin!
    .from('platform_events')
    .update({ workflow_statuses: reindexed })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  revalidateAll(eventId)
  return { success: true }
}

export async function reorderWorkflowStatuses(
  eventId: string,
  orderedIds: string[],
): Promise<{ success: true } | { error: string }> {
  const { error, admin, event } = await fetchEventWithStatuses(eventId)
  if (error || !event) return { error: error ?? 'Not found.' }

  const statuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const statusMap = new Map(statuses.map(s => [s.id, s]))

  // Validate: orderedIds must contain exactly the same IDs as current statuses
  if (orderedIds.length !== statuses.length || orderedIds.some(id => !statusMap.has(id))) {
    return { error: 'Invalid status IDs.' }
  }

  const reordered = orderedIds.map((id, i) => ({ ...statusMap.get(id)!, order: i + 1 }))

  const { error: updateError } = await admin!
    .from('platform_events')
    .update({ workflow_statuses: reordered })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  revalidateAll(eventId)
  return { success: true }
}
