'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BadgeTemplateConfig } from '@/types/badge-template'
import { epEventGuard } from '@/lib/auth/ep-guard'

export async function saveBadgeTemplate(
  eventId: string,
  name: string,
  config: BadgeTemplateConfig,
  backgroundImageUrl?: string | null,
  sourceTemplateId?: string,
): Promise<{ success: boolean; error?: string }> {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { success: false, error: 'Access denied.' }

  // Validate config
  if (
    !config.dimensions ||
    config.dimensions.width <= 0 ||
    config.dimensions.height <= 0
  ) {
    return { success: false, error: 'Invalid dimensions.' }
  }
  if (!config.textColor) {
    return { success: false, error: 'Text color is required.' }
  }
  if (!config.fontFamily) {
    return { success: false, error: 'Font family is required.' }
  }
  if (config.border.width < 0) {
    return { success: false, error: 'Border width cannot be negative.' }
  }
  if (config.border.radius < 0) {
    return { success: false, error: 'Border radius cannot be negative.' }
  }
  if (config.photo.size <= 0) {
    return { success: false, error: 'Photo size must be positive.' }
  }

  const templateData: Record<string, unknown> = {
    event_id: eventId,
    name: name || null,
    config,
    background_image_url: backgroundImageUrl ?? null,
  }
  if (sourceTemplateId) {
    templateData.source_template_id = sourceTemplateId
  }

  // Upsert: one template per event
  const { error } = await admin.from('badge_templates').upsert(templateData, {
    onConflict: 'event_id',
  })

  if (error) {
    console.error('saveBadgeTemplate error:', error)
    return { success: false, error: 'Failed to save badge template.' }
  }

  revalidatePath(`/ep/events/${eventId}/badge`)
  revalidatePath(`/ep/events/${eventId}/badge/builder`)
  revalidatePath(`/events/${eventId}/badge`)

  return { success: true }
}

export interface PastTemplate {
  id: string
  eventId: string
  eventTitle: string
  name: string | null
  config: BadgeTemplateConfig
  backgroundImageUrl: string | null
}

export async function getEpPastBadgeTemplates(
  currentEventId: string,
): Promise<PastTemplate[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  // Get all events owned by this EP
  const { data: events } = await supabase
    .from('platform_events')
    .select('id, title')
    .eq('owner_id', user.id)
    .neq('id', currentEventId)

  if (!events || events.length === 0) return []

  const eventIds = events.map((e) => e.id)
  const eventMap = new Map(events.map((e) => [e.id, e.title]))

  // Fetch badge templates for those events
  const { data: templates } = await admin
    .from('badge_templates')
    .select('id, event_id, name, config, background_image_url')
    .in('event_id', eventIds)

  if (!templates || templates.length === 0) return []

  return templates.map((t) => ({
    id: t.id as string,
    eventId: t.event_id as string,
    eventTitle: eventMap.get(t.event_id as string) || 'Unknown Event',
    name: t.name as string | null,
    config: t.config as BadgeTemplateConfig,
    backgroundImageUrl: t.background_image_url as string | null,
  }))
}
