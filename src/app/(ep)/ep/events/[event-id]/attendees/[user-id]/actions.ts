'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateApplicationStatus(
  eventId: string,
  targetUserId: string,
  newStatus: string,
  action?: 'revoke_and_refund' | 'block_only',
  epNote?: string
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

  // Fetch current attendee state
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, ticket_status, order_id')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .single()
  if (!attendee) return { error: 'Attendee not found.' }

  const wasApproved = attendee.application_status === 'Approved'
  const hasTicket = attendee.ticket_status === 'Complete'

  // Reverted approval — require explicit action choice if ticket exists
  if (wasApproved && newStatus !== 'Approved' && hasTicket && !action) {
    return { requiresModal: true }
  }

  if (action === 'revoke_and_refund') {
    // TODO: call refund API for order attendee.order_id — not yet implemented (Step 6)
    console.log(`[TODO] initiate refund for order ${attendee.order_id}`)
    // Mark ticket cancelled
    await supabase
      .from('event_attendees')
      .update({ ticket_status: 'Incomplete', order_id: null })
      .eq('event_id', eventId)
      .eq('user_id', targetUserId)
  }

  // Update application status
  const { error } = await supabase
    .from('event_attendees')
    .update({ application_status: newStatus })
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
  if (error) return { error: error.message }

  // TODO: send notification to user on Approved/Declined — Step 12

  revalidatePath(`/ep/events/${eventId}/attendees/${targetUserId}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)
  return { success: true }
}
