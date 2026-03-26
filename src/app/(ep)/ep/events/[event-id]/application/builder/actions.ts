'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface FormFieldInput {
  id: string
  type: 'text' | 'radio' | 'checkbox' | 'key_value'
  label: string
  options: string[]
  required: boolean
  order: number
}

export async function saveForm(
  eventId: string,
  title: string,
  fields: FormFieldInput[],
  sourceFormId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify EP owns this event
  const { data: event } = await supabase
    .from('platform_events')
    .select('id')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  if (!event) return { error: 'Access denied.' }

  if (!title.trim()) return { error: 'Form title is required.' }
  if (fields.length === 0) return { error: 'Add at least one field.' }

  for (const f of fields) {
    if (!f.label.trim()) return { error: 'All fields must have a label.' }
    if ((f.type === 'radio' || f.type === 'checkbox') && f.options.length < 2) {
      return { error: `"${f.label}" needs at least 2 options.` }
    }
  }

  const { error } = await supabase
    .from('application_forms')
    .upsert(
      {
        event_id: eventId,
        source_form_id: sourceFormId ?? null,
        title,
        fields,
      },
      { onConflict: 'event_id' }
    )
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/application/builder`)
  return { success: true }
}

/** Returns all application forms from events owned by this EP (excluding the current event). */
export async function getEpPastForms(currentEventId: string) {
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
  const { data: forms } = await supabase
    .from('application_forms')
    .select('id, event_id, title, fields')
    .in('event_id', eventIds)

  if (!forms) return []

  return forms.map(f => ({
    ...f,
    eventTitle: events.find(e => e.id === f.event_id)?.title ?? '',
  }))
}
