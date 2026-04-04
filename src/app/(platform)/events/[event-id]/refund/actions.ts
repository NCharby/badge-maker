'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  getApplicableRefundPercentage,
  calculateTicketRefundCents,
  isHardshipAvailable,
} from '@/lib/refunds'
import { getPaymentProvider } from '@/lib/payments'
import { createInPlatformNotification } from '@/lib/notifications'
import type { WorkflowStatus, CancellationPolicy } from '@/types/platform'

// ─── Standard refund ─────────────────────────────────────────────────────────

export async function requestStandardRefund(
  eventId: string,
): Promise<{ success: true; refundedAmount: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()

  // Fetch event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, status, workflow_statuses, cancellation_policy, owner_id')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found.' }

  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const cancellationPolicy = (event.cancellation_policy ?? null) as CancellationPolicy | null

  // Fetch attendee record
  const { data: attendee } = await admin
    .from('event_attendees')
    .select('ticket_status, order_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()
  if (!attendee) return { error: 'Attendee record not found.' }
  if (attendee.ticket_status !== 'Complete') return { error: 'No completed ticket purchase found.' }
  if (!attendee.order_id) return { error: 'No order associated with your ticket.' }

  // Fetch order + items
  const { data: order } = await admin
    .from('orders')
    .select('id, payment_provider, payment_transaction_id, subtotal, amount_refunded, status')
    .eq('id', attendee.order_id)
    .single()
  if (!order) return { error: 'Order not found.' }

  const { data: orderItems } = await admin
    .from('order_items')
    .select('item_type, unit_price, quantity, amount_refunded')
    .eq('order_id', attendee.order_id)
  if (!orderItems) return { error: 'Order items not found.' }

  // Determine applicable refund percentage
  const percentage = getApplicableRefundPercentage(
    event.status,
    workflowStatuses,
    cancellationPolicy,
  )
  if (percentage === 0) {
    return { error: 'No refund is available at the current event status.' }
  }

  // Calculate refund in cents
  const amountCents = calculateTicketRefundCents(
    orderItems.map(i => ({
      item_type: i.item_type,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
      amount_refunded: Number(i.amount_refunded),
    })),
    percentage,
  )
  if (amountCents <= 0) {
    return { error: 'No refundable amount remains on this order.' }
  }

  // Verify a payment transaction exists to refund
  if (!order.payment_transaction_id) {
    return { error: 'This order has no payment transaction on record and cannot be refunded automatically. Please contact support.' }
  }

  // Validate payment provider before calling API
  if (!order.payment_provider || !['square', 'paypal'].includes(order.payment_provider)) {
    return { error: 'Cannot process refund: payment provider on this order is not recognized.' }
  }

  // Call refund API
  const provider = getPaymentProvider(order.payment_provider as 'square' | 'paypal')
  const refundResult = await provider.refundPayment({
    transactionId: order.payment_transaction_id,
    amountCents,
    orderId: order.id,
  })
  if (!refundResult.success) {
    return { error: refundResult.error ?? 'Refund failed. Please try again or contact support.' }
  }

  // Accumulate refunded amount using integer cent arithmetic
  const previousRefundedCents = Math.round(Number(order.amount_refunded) * 100)
  const newRefundedCents = previousRefundedCents + amountCents
  const newAmountRefunded = parseFloat((newRefundedCents / 100).toFixed(2))
  const newStatus = newRefundedCents >= Math.round(Number(order.subtotal) * 100)
    ? 'refunded'
    : 'partial_refund'

  // Update order
  await admin
    .from('orders')
    .update({
      status: newStatus,
      amount_refunded: newAmountRefunded,
      refund_channel: 'standard',
    })
    .eq('id', order.id)

  // Distribute refund across ticket order_items (pro-rata; ticket items only)
  const ticketItems = orderItems.filter(i => i.item_type === 'ticket')
  const ticketTotalCents = ticketItems.reduce(
    (s, i) => s + Math.round(Number(i.unit_price) * Number(i.quantity) * 100),
    0,
  )
  if (ticketTotalCents > 0) {
    for (const item of ticketItems) {
      const itemTotalCents = Math.round(Number(item.unit_price) * Number(item.quantity) * 100)
      const itemShare = Math.round((itemTotalCents / ticketTotalCents) * amountCents)
      const newItemRefunded = parseFloat(
        ((Math.round(Number(item.amount_refunded) * 100) + itemShare) / 100).toFixed(2),
      )
      await admin
        .from('order_items')
        .update({ amount_refunded: newItemRefunded })
        .eq('order_id', order.id)
        .eq('item_type', 'ticket')
    }
  }

  // Reset attendee ticket status
  await admin
    .from('event_attendees')
    .update({ ticket_status: 'Incomplete', order_id: null })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  // Fetch display name for EP notification
  const { data: pu } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', user.id)
    .single()
  const displayName = (pu?.preferred_scene_name?.trim() || pu?.email?.split('@')[0]) ?? 'An attendee'

  // Notify EP (fire-and-forget)
  void createInPlatformNotification({
    userId: event.owner_id,
    type: 'standard_refund_processed',
    title: 'Refund Processed',
    body: `${displayName} received a ${percentage}% refund for ${event.title ?? 'the event'}.`,
    actionUrl: `/ep/events/${eventId}/attendees`,
    actionLabel: 'View Attendees',
    eventId,
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)

  return { success: true, refundedAmount: amountCents / 100 }
}

// ─── Hardship request ─────────────────────────────────────────────────────────

export async function submitHardshipRequest(
  eventId: string,
  reason: string,
  supportingDetails?: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()

  // Fetch event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, status, workflow_statuses, cancellation_policy, owner_id')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found.' }

  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const cancellationPolicy = (event.cancellation_policy ?? null) as CancellationPolicy | null

  if (!isHardshipAvailable(event.status, workflowStatuses, cancellationPolicy)) {
    return { error: 'Hardship cancellation requests are not available for this event at this time.' }
  }

  // Validate reason
  if (!reason || reason.trim().length === 0) {
    return { error: 'A reason is required for a hardship cancellation request.' }
  }

  // Fetch attendee record
  const { data: attendee } = await admin
    .from('event_attendees')
    .select('ticket_status, order_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()
  if (!attendee) return { error: 'Attendee record not found.' }
  if (attendee.ticket_status !== 'Complete') return { error: 'No completed ticket purchase found.' }
  if (!attendee.order_id) return { error: 'No order associated with your ticket.' }

  // Insert hardship request (admin client — service role bypasses RLS for insert)
  const { error: insertError } = await admin
    .from('hardship_requests')
    .insert({
      event_id: eventId,
      user_id: user.id,
      order_id: attendee.order_id,
      status: 'pending',
      reason: reason.trim(),
      supporting_details: supportingDetails?.trim() ?? null,
    })
  if (insertError) return { error: insertError.message }

  // Fetch display name for EP notification
  const { data: pu } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', user.id)
    .single()
  const displayName = (pu?.preferred_scene_name?.trim() || pu?.email?.split('@')[0]) ?? 'An attendee'

  // Notify EP (fire-and-forget)
  void createInPlatformNotification({
    userId: event.owner_id,
    type: 'hardship_request_submitted',
    title: 'Hardship Cancellation Request',
    body: `${displayName} submitted a hardship cancellation request for ${event.title ?? 'the event'}.`,
    actionUrl: `/ep/events/${eventId}/attendees`,
    actionLabel: 'View Attendees',
    eventId,
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/ep/events/${eventId}/attendees`)

  return { success: true }
}
