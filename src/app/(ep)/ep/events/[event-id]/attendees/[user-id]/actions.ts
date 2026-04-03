'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { getPaymentProvider } from '@/lib/payments'
import { sendTelegramDM } from '@/lib/telegram/send'
import { epEventGuard } from '@/lib/auth/ep-guard'

export async function updateApplicationStatus(
  eventId: string,
  targetUserId: string,
  newStatus: string,
  action?: 'revoke_and_refund' | 'block_only',
  epNote?: string
) {
  const { authorized, admin: guardAdmin } = await epEventGuard(eventId)
  if (!authorized || !guardAdmin) return { error: 'Access denied.' }

  const { data: event } = await guardAdmin
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found.' }

  // Fetch current attendee state
  const { data: attendee } = await guardAdmin
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
      const refundAdmin = createAdminClient()
      const { data: order } = await refundAdmin
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
        await refundAdmin
          .from('orders')
          .update({ status: 'refunded', amount_refunded: order.subtotal })
          .eq('id', attendee.order_id)
      }
    }
    // Reset ticket status regardless of whether a payment refund was needed
    await guardAdmin
      .from('event_attendees')
      .update({ ticket_status: 'Incomplete', order_id: null })
      .eq('event_id', eventId)
      .eq('user_id', targetUserId)
  }

  // Update application status
  const { error } = await guardAdmin
    .from('event_attendees')
    .update({ application_status: newStatus })
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
  if (error) return { error: error.message }

  const eventTitle = event.title ?? 'the event'

  // Row 14: user locked by EP → notify attendee (in-platform + Telegram)
  if (newStatus === 'Locked') {
    const row14Body = `Your attendance for ${eventTitle} has been locked. No further changes can be made.`
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'attendee_locked',
      title: 'Your attendance has been locked',
      body: row14Body,
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
    void sendTelegramDM(targetUserId, row14Body)
  }

  // Application approved/declined → notify attendee (in-platform + Telegram)
  if (newStatus === 'Approved') {
    const approvedBody = `Your application for ${eventTitle} has been approved. Check your event hub for next steps.`
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'application_approved',
      title: 'Your application has been approved',
      body: approvedBody,
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
    void sendTelegramDM(targetUserId, approvedBody)
  } else if (newStatus === 'Declined') {
    const declinedBody = `Your application for ${eventTitle} was not approved at this time.`
    void createInPlatformNotification({
      userId: targetUserId,
      type: 'application_declined',
      title: 'Your application was not approved',
      body: declinedBody,
      actionUrl: `/events/${eventId}`,
      actionLabel: 'View Event Hub',
      eventId,
    })
    void sendTelegramDM(targetUserId, declinedBody)
  }

  revalidatePath(`/ep/events/${eventId}/attendees/${targetUserId}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)
  return { success: true }
}
