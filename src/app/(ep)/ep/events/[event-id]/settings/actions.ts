'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateEventDetails(
  eventId: string,
  data: {
    title: string
    description: string
    start_date: string
    end_date: string
    location: string
    venue_id: string | null
  },
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, module_config')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  if (!event) return { error: 'Access denied.' }

  const title = data.title.trim()
  if (!title) return { error: 'Event title is required.' }
  if (!data.start_date) return { error: 'Start date is required.' }
  if (!data.end_date) return { error: 'End date is required.' }
  if (data.end_date < data.start_date) return { error: 'End date must be on or after start date.' }

  // Sync module_config with venue_id change.
  // Venue and Room Selection are mutually exclusive — absent key = disabled per spec.
  const moduleConfig: Record<string, object | undefined> = {
    ...((event.module_config as Record<string, object | undefined>) ?? {}),
  }
  if (data.venue_id) {
    // Assigning a venue: enable venue module; remove room_selection (absent = disabled)
    moduleConfig.venue = { ...(moduleConfig.venue ?? {}), enabled: true }
    delete moduleConfig.room_selection
  } else {
    // Clearing venue: disable venue module; leave room_selection unchanged
    delete moduleConfig.venue
  }

  const { error } = await supabase
    .from('platform_events')
    .update({
      title,
      description: data.description.trim() || null,
      start_date: data.start_date,
      end_date: data.end_date,
      location: data.location.trim() || null,
      venue_id: data.venue_id || null,
      module_config: moduleConfig,
    })
    .eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/settings`)
  revalidatePath(`/ep/events/${eventId}/venue`)
  revalidatePath(`/ep/events/${eventId}/rooms`)
  revalidatePath('/ep/dashboard')
  return { success: true }
}
