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
    room_lock_in_date: string
  },
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: event } = await supabase
    .from('platform_events')
    .select('id')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  if (!event) return { error: 'Access denied.' }

  const title = data.title.trim()
  if (!title) return { error: 'Event title is required.' }
  if (!data.start_date) return { error: 'Start date is required.' }
  if (!data.end_date) return { error: 'End date is required.' }
  if (data.end_date < data.start_date) return { error: 'End date must be on or after start date.' }

  const { error } = await supabase
    .from('platform_events')
    .update({
      title,
      description: data.description.trim() || null,
      start_date: data.start_date,
      end_date: data.end_date,
      room_lock_in_date: data.room_lock_in_date || null,
    })
    .eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/settings`)
  revalidatePath(`/ep/events/${eventId}/notifications`)
  revalidatePath('/ep/dashboard')
  return { success: true }
}
