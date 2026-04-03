'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { epEventGuard } from '@/lib/auth/ep-guard'

export async function saveWaiverTemplate(
  eventId: string,
  content: string,
  sourceTemplateId?: string,
) {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Access denied.' }

  if (!content.trim()) return { error: 'Waiver content cannot be empty.' }

  const { error } = await admin
    .from('waiver_templates')
    .upsert(
      {
        event_id: eventId,
        source_template_id: sourceTemplateId ?? null,
        content,
      },
      { onConflict: 'event_id' },
    )
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/waiver/builder`)
  revalidatePath(`/ep/events/${eventId}/waiver`)
  return { success: true }
}

/** Returns all waiver templates from events owned by this EP (excluding the current event). */
export async function getEpPastWaiverTemplates(currentEventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get all events owned by this EP (excluding current event)
  const { data: events } = await supabase
    .from('platform_events')
    .select('id, title')
    .eq('owner_id', user.id)
    .neq('id', currentEventId)

  if (!events || events.length === 0) return []

  const eventIds = events.map(e => e.id)
  const { data: templates } = await supabase
    .from('waiver_templates')
    .select('id, event_id, content')
    .in('event_id', eventIds)

  if (!templates) return []

  return templates.map(t => ({
    id: t.id,
    eventId: t.event_id,
    eventTitle: events.find(e => e.id === t.event_id)?.title ?? '',
    content: t.content,
  }))
}
