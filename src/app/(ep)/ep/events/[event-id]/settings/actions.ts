'use server'

import { revalidatePath } from 'next/cache'
import { epEventGuard } from '@/lib/auth/ep-guard'

export async function updateEventDetails(
  eventId: string,
  data: {
    title: string
    description: string
    start_date: string
    end_date: string
    room_lock_in_date: string
    late_registration_enabled: boolean
    late_registration_email: string
  },
): Promise<{ success: true } | { error: string }> {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Access denied.' }

  const title = data.title.trim()
  if (!title) return { error: 'Event title is required.' }
  if (!data.start_date) return { error: 'Start date is required.' }
  if (!data.end_date) return { error: 'End date is required.' }
  if (data.end_date < data.start_date) return { error: 'End date must be on or after start date.' }

  const { error } = await admin
    .from('platform_events')
    .update({
      title,
      description: data.description.trim() || null,
      start_date: data.start_date,
      end_date: data.end_date,
      room_lock_in_date: data.room_lock_in_date || null,
      late_registration_enabled: data.late_registration_enabled,
      late_registration_email: data.late_registration_email.trim() || null,
    })
    .eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/settings`)
  revalidatePath(`/ep/events/${eventId}/notifications`)
  revalidatePath('/ep/dashboard')
  revalidatePath('/events/browse')
  return { success: true }
}
