'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { getPaymentProvider } from '@/lib/payments'
import { calculateTicketRefundCents } from '@/lib/refunds'
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
          .update({ status: 'refunded', amount_refunded: order.subtotal, refund_channel: 'standard' })
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

export async function approveHardshipRequest(
  eventId: string,
  requestId: string,
  refundPercentage: number,
  epNote?: string,
): Promise<{ success: true } | { error: string }> {
  const { authorized, user, admin } = await epEventGuard(eventId)
  if (!authorized || !user || !admin) return { error: 'Access denied.' }

  // Fetch the hardship request and verify it is still pending
  const { data: request } = await admin
    .from('hardship_requests')
    .select('id, user_id, order_id, status')
    .eq('id', requestId)
    .eq('event_id', eventId)
    .single()

  if (!request) return { error: 'Hardship request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  // Fetch the order and its items
  const refundAdmin = createAdminClient()

  const { data: order } = await refundAdmin
    .from('orders')
    .select('id, payment_transaction_id, payment_provider, subtotal, amount_refunded, status')
    .eq('id', request.order_id)
    .single()

  if (!order) return { error: 'Associated order not found.' }

  const { data: orderItems } = await refundAdmin
    .from('order_items')
    .select('item_type, unit_price, quantity, amount_refunded')
    .eq('order_id', request.order_id)

  if (!orderItems) return { error: 'Order items not found.' }

  const amountCents = calculateTicketRefundCents(
    orderItems as { item_type: string; unit_price: number; quantity: number; amount_refunded: number }[],
    refundPercentage,
  )

  // Process payment refund if there is an amount to refund and a transaction to refund against
  if (amountCents > 0 && order.payment_transaction_id) {
    if (!order.payment_provider || !(['square', 'paypal'] as string[]).includes(order.payment_provider)) {
      return { error: 'Cannot process refund: payment provider on this order is not recognized.' }
    }
    const provider = getPaymentProvider(order.payment_provider as 'square' | 'paypal')
    const refundResult = await provider.refundPayment({
      transactionId: order.payment_transaction_id,
      amountCents,
      orderId: order.id,
    })
    if (!refundResult.success) {
      return { error: refundResult.error ?? 'Refund failed. Please try again or process the refund manually.' }
    }
  }

  // Update hardship request to approved
  const { error: hrError } = await admin
    .from('hardship_requests')
    .update({
      status: 'approved',
      refund_percentage: refundPercentage,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      ep_note: epNote ?? null,
    })
    .eq('id', requestId)
  if (hrError) return { error: hrError.message }

  // Update order status and amount_refunded
  const newAmountRefunded = parseFloat((Number(order.amount_refunded) + amountCents / 100).toFixed(2))
  const newOrderStatus = newAmountRefunded >= Number(order.subtotal) ? 'refunded' : 'partial_refund'
  await refundAdmin
    .from('orders')
    .update({
      status: newOrderStatus,
      amount_refunded: newAmountRefunded,
      refund_channel: 'hardship',
    })
    .eq('id', order.id)

  // Reset the attendee's ticket status
  await admin
    .from('event_attendees')
    .update({ ticket_status: 'Incomplete', order_id: null })
    .eq('event_id', eventId)
    .eq('user_id', request.user_id)

  // Notify the attendee
  void createInPlatformNotification({
    userId: request.user_id,
    type: 'hardship_request_approved',
    title: 'Hardship Request Approved',
    body: 'Your hardship cancellation request has been approved. Your refund will be processed according to the approved percentage.',
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event Hub',
    eventId,
  })

  revalidatePath(`/ep/events/${eventId}/attendees/${request.user_id}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)
  return { success: true }
}

export async function denyHardshipRequest(
  eventId: string,
  requestId: string,
  epNote?: string,
): Promise<{ success: true } | { error: string }> {
  const { authorized, user, admin } = await epEventGuard(eventId)
  if (!authorized || !user || !admin) return { error: 'Access denied.' }

  // Fetch the hardship request and verify it is still pending
  const { data: request } = await admin
    .from('hardship_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .eq('event_id', eventId)
    .single()

  if (!request) return { error: 'Hardship request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  // Update hardship request to denied
  const { error: hrError } = await admin
    .from('hardship_requests')
    .update({
      status: 'denied',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      ep_note: epNote ?? null,
    })
    .eq('id', requestId)
  if (hrError) return { error: hrError.message }

  // Notify the attendee
  void createInPlatformNotification({
    userId: request.user_id,
    type: 'hardship_request_denied',
    title: 'Hardship Request Denied',
    body: 'Your hardship cancellation request has been reviewed and was not approved. Please contact the event organizer if you have questions.',
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event Hub',
    eventId,
  })

  revalidatePath(`/ep/events/${eventId}/attendees/${request.user_id}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)
  return { success: true }
}
