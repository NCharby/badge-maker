'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { getPaymentProvider } from '@/lib/payments'

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
    if (attendee.order_id) {
      const admin = createAdminClient()
      const { data: order } = await admin
        .from('orders')
        .select('payment_transaction_id, subtotal, payment_provider')
        .eq('id', attendee.order_id)
        .single()

      if (order?.payment_transaction_id) {
        if (!order.payment_provider || !['square', 'paypal'].includes(order.payment_provider)) {
          return { error: 'Cannot process refund: payment provider on this order is not recognized.' }
        }
        const provider = getPaymentProvider(order.payment_provider as 'square' | 'paypal')
        const amountCents = Math.round(Number(order.subtotal) * 100)
        const refundResult = await provider.refundPayment({
          transactionId: order.payment_transaction_id,
          amountCents,
          orderId: attendee.order_id,
        })
        if (!refundResult.success) {
          return { error: refundResult.error ?? 'Refund failed. Please try again or process the refund manually.' }
        }
        await admin
          .from('orders')
          .update({ status: 'refunded', amount_refunded: order.subtotal })
          .eq('id', attendee.order_id)
      }
    }
    // Reset ticket status regardless of whether a payment refund was needed
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

  // Row 14: user locked by EP → notify attendee (in-platform + email + Telegram)
  // TODO: send email + Telegram to attendee: event name, confirmation
  if (newStatus === 'Locked') {
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'attendee_locked',
      title: 'Your attendance has been locked',
      body: 'The Event Promoter has locked your attendance. No further changes can be made.',
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
  }

  // Application approved/declined → notify attendee (in-platform + email + Telegram)
  // TODO: send email + Telegram to attendee: event name, next steps
  if (newStatus === 'Approved') {
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'application_approved',
      title: 'Your application has been approved',
      body: 'The Event Promoter has approved your application. Check your event hub for next steps.',
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
  } else if (newStatus === 'Declined') {
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'application_declined',
      title: 'Your application was not approved',
      body: 'The Event Promoter has reviewed your application and was unable to approve it at this time.',
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
  }

  revalidatePath(`/ep/events/${eventId}/attendees/${targetUserId}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)
  return { success: true }
}
