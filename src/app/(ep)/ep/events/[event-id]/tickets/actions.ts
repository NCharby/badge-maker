'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { epEventGuard } from '@/lib/auth/ep-guard'

export interface TicketTypeInput {
  name: string
  description: string
  price: string           // string from form; parsed to decimal
  available_count: string // empty string = unlimited (null)
  room_lead: boolean
  roommate_codes_enabled: boolean
  volunteer_hours_required: string
  room_required_at_purchase: boolean
}

function parseTicketTypeInput(data: TicketTypeInput):
  | { error: string }
  | {
      error: null
      values: {
        name: string
        description: string | null
        price: number
        available_count: number | null
        room_lead: boolean
        roommate_codes_enabled: boolean
        volunteer_hours_required: number
        room_required_at_purchase: boolean
      }
    }
{
  const name = data.name.trim()
  if (!name) return { error: 'Name is required.' }

  const price = parseFloat(data.price || '0')
  if (isNaN(price) || price < 0) return { error: 'Price must be 0 or greater.' }

  const countStr = data.available_count.trim()
  const available_count = countStr === '' ? null : parseInt(countStr, 10)
  if (available_count !== null && (isNaN(available_count) || available_count < 1)) {
    return { error: 'Available count must be a positive number, or leave blank for unlimited.' }
  }

  const volunteer_hours_required = parseInt(data.volunteer_hours_required || '0', 10)
  if (isNaN(volunteer_hours_required) || volunteer_hours_required < 0) {
    return { error: 'Volunteer hours must be 0 or greater.' }
  }

  // roommate_codes_enabled is only meaningful when room_lead = true; force false otherwise
  const roommate_codes_enabled = data.room_lead ? data.roommate_codes_enabled : false

  return {
    error: null,
    values: {
      name,
      description: data.description.trim() || null,
      price,
      available_count,
      room_lead: data.room_lead,
      roommate_codes_enabled,
      volunteer_hours_required,
      room_required_at_purchase: data.room_required_at_purchase,
    },
  }
}

export async function createTicketType(
  eventId: string,
  data: TicketTypeInput,
): Promise<{ success: true } | { error: string }> {
  const { authorized } = await epEventGuard(eventId)
  if (!authorized) return { error: 'Access denied.' }

  const parsed = parseTicketTypeInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = createAdminClient()
  const { error } = await admin.from('ticket_types').insert({ event_id: eventId, ...parsed.values })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/tickets`)
  return { success: true }
}

export async function updateTicketType(
  ticketTypeId: string,
  eventId: string,
  data: TicketTypeInput,
): Promise<{ success: true } | { error: string }> {
  const { authorized } = await epEventGuard(eventId)
  if (!authorized) return { error: 'Access denied.' }

  const parsed = parseTicketTypeInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ticket_types').update(parsed.values).eq('id', ticketTypeId).eq('event_id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/tickets`)
  return { success: true }
}

export async function deleteTicketType(
  ticketTypeId: string,
  eventId: string,
): Promise<{ success: true } | { error: string }> {
  const { authorized } = await epEventGuard(eventId)
  if (!authorized) return { error: 'Access denied.' }

  const admin = createAdminClient()

  // Block deletion if this ticket type has been purchased
  const { count } = await admin
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_type_id', ticketTypeId)
    .eq('ticket_status', 'Complete')
  if ((count ?? 0) > 0) return { error: 'Cannot delete a ticket type that has been purchased.' }

  const { error } = await admin
    .from('ticket_types').delete().eq('id', ticketTypeId).eq('event_id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/tickets`)
  return { success: true }
}
