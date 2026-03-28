'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowStatus } from '@/types/platform'

const SYSTEM_STATUSES = ['Draft', 'Published', 'Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

export type ModuleCfg = {
  enabled: boolean
  required: boolean
  opens_at_status: string | null
  closes_at_status: string | null
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
    return { error: 'Venue and Room Selection cannot both be enabled. They represent the same room workflow — enable one or the other.' }
  }

  // Validate opens_at_status and closes_at_status values against known statuses
  const customStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const validStatusValues = new Set([
    ...SYSTEM_STATUSES,
    ...customStatuses.map(s => s.id), // custom statuses referenced by UUID
  ])

  for (const [key, cfg] of Object.entries(moduleConfig)) {
    if (!cfg.enabled) continue
    if (cfg.opens_at_status && !validStatusValues.has(cfg.opens_at_status)) {
      return { error: `Invalid opens_at_status for module "${key}".` }
    }
    if (cfg.closes_at_status && !validStatusValues.has(cfg.closes_at_status)) {
      return { error: `Invalid closes_at_status for module "${key}".` }
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
