'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowStatus } from '@/types/platform'

// Only 'Published' and custom status UUIDs are valid for opens_at/closes_at
// (system statuses like 'Draft', 'Event Locked', etc. are excluded from module triggers)
const ALLOWED_SYSTEM_STATUSES = new Set(['Published'])

export type ModuleCfg = {
  enabled: boolean
  required: boolean
  opens_at_status: string | null
  closes_at_status: string | null
  room_selection_workflow?: boolean
  custom_status_message_enabled?: boolean
  custom_status_message?: string
}

export async function updateModuleConfig(
  eventId: string,
  moduleConfig: Record<string, ModuleCfg>,
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

  // Ticketing must always remain enabled
  if (!moduleConfig.ticketing?.enabled) {
    return { error: 'Ticketing module cannot be disabled.' }
  }

  // venue and room_selection are mutually exclusive
  if (moduleConfig.venue?.enabled && moduleConfig.room_selection?.enabled) {
    return { error: 'Venue and Basic Event Rooms cannot both be enabled.' }
  }

  // Validate opens_at_status and closes_at_status
  const customStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const customStatusUUIDs = new Set(customStatuses.map(s => s.id))

  for (const [key, cfg] of Object.entries(moduleConfig)) {
    if (!cfg.enabled) continue
    for (const field of ['opens_at_status', 'closes_at_status'] as const) {
      const val = cfg[field]
      if (!val) continue
      if (!ALLOWED_SYSTEM_STATUSES.has(val) && !customStatusUUIDs.has(val)) {
        return { error: `Invalid ${field} for module "${key}". Only "Published" and custom workflow statuses are allowed.` }
      }
    }
  }

  const { error: updateError } = await supabase
    .from('platform_events')
    .update({ module_config: moduleConfig })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/modules`)
  return { success: true }
}
