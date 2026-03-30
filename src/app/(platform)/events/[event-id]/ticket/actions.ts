'use server'

import { randomBytes } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { getPaymentProvider, getEpPaymentProvider } from '@/lib/payments'
import { revalidatePath } from 'next/cache'
import { sendTelegramMessage } from '@/lib/telegram/send'

// 6-char uppercase alphanumeric excluding visually ambiguous chars (0, O, 1, I, L)
const ROOMMATE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateRoommateCode(): string {
  let code = ''
  while (code.length < 6) {
    const byte = randomBytes(1)[0]
    // Rejection sampling to avoid modulo bias
    if (byte < ROOMMATE_CODE_CHARS.length * Math.floor(256 / ROOMMATE_CODE_CHARS.length)) {
      code += ROOMMATE_CODE_CHARS[byte % ROOMMATE_CODE_CHARS.length]
    }
  }
  return code
}

export async function purchaseTicket(
  eventId: string,
  ticketTypeId: string,
  shiftIds: string[],          // empty if no volunteer hours required
  merchandiseIds: string[],    // empty if no merchandise selected
  roommateCode?: string,       // optional — non-Room-Lead attendees may supply a Room Lead's code
  // null = $0 order (skip payment); omitted = same as null
  paymentToken?: { provider: 'square'; nonce: string }
              | { provider: 'paypal'; paypalOrderId: string }
              | null,
): Promise<{ success: true; orderId: string; roommate_code?: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Fetch or create attendee record
  const adminSupabase = createAdminClient()
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) {
    // No attendee record yet — completing a ticket purchase IS the enrollment action.
    const { error: enrollError } = await adminSupabase
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: user.id })
    if (enrollError) return { error: 'Failed to enroll. Please try again.' }
  } else {
    if (attendee.ticket_status === 'Complete') return { error: 'You already have a ticket for this event.' }
    if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked — no further changes can be made.' }
  }

  // 2. Ticket type guard — must belong to this event
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id, name, price, available_count, room_lead, roommate_codes_enabled, volunteer_hours_required, room_required_at_purchase')
    .eq('id', ticketTypeId)
    .eq('event_id', eventId)
    .single()
  if (!ticketType) return { error: 'Ticket type not found.' }

  // Discard shift IDs if this ticket type requires no volunteer hours
  const effectiveShiftIds = ticketType.volunteer_hours_required > 0 ? shiftIds : []

  // 3. Volunteer hours + overlap validation
  if (ticketType.volunteer_hours_required > 0) {
    if (effectiveShiftIds.length === 0) {
      return { error: 'You must select volunteer shifts for this ticket type.' }
    }
    const { data: shifts } = await supabase
      .from('volunteer_shifts')
      .select('id, duration_minutes, event_id, date_time')
      .in('id', effectiveShiftIds)
    if (!shifts || shifts.length !== effectiveShiftIds.length) return { error: 'Invalid shift selection.' }
    if (shifts.some(s => s.event_id !== eventId)) return { error: 'Invalid shift selection.' }

    // Hours check
    const totalMinutes = shifts.reduce((sum, s) => sum + s.duration_minutes, 0)
    if (totalMinutes < ticketType.volunteer_hours_required * 60) {
      return { error: `Select at least ${ticketType.volunteer_hours_required} hours of volunteer shifts.` }
    }

    // Overlap check among selected shifts
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        const aStart = new Date(shifts[i].date_time).getTime()
        const aEnd = aStart + shifts[i].duration_minutes * 60_000
        const bStart = new Date(shifts[j].date_time).getTime()
        const bEnd = bStart + shifts[j].duration_minutes * 60_000
        if (aStart < bEnd && bStart < aEnd) {
          return { error: 'Your selected shifts overlap. Please choose non-overlapping shifts.' }
        }
      }
    }

    // Overlap check against existing confirmed signups for this user/event
    const { data: existingSignups } = await supabase
      .from('user_volunteer_signups')
      .select('volunteer_shifts(id, date_time, duration_minutes)')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .eq('status', 'confirmed')

    if (existingSignups) {
      for (const signup of existingSignups) {
        const es = (signup.volunteer_shifts as { id: string; date_time: string; duration_minutes: number }[] | null)?.[0]
        if (!es) continue
        const eStart = new Date(es.date_time).getTime()
        const eEnd = eStart + es.duration_minutes * 60_000
        for (const s of shifts) {
          const sStart = new Date(s.date_time).getTime()
          const sEnd = sStart + s.duration_minutes * 60_000
          if (sStart < eEnd && eStart < sEnd) {
            return { error: 'A selected shift overlaps with a shift you already have.' }
          }
        }
      }
    }
  }

  // 4. Fetch and validate merchandise
  type MerchRow = { id: string; name: string; price: number; available_count: number | null; ticket_type_restriction: string[] | null; enabled: boolean }
  let merchandiseItems: MerchRow[] = []
  if (merchandiseIds.length > 0) {
    const { data: merch } = await supabase
      .from('merchandise')
      .select('id, name, price, available_count, ticket_type_restriction, enabled')
      .in('id', merchandiseIds)
      .eq('event_id', eventId)
    if (!merch || merch.length !== merchandiseIds.length) return { error: 'Invalid merchandise selection.' }
    for (const item of merch as MerchRow[]) {
      if (!item.enabled) return { error: `${item.name} is no longer available.` }
      if (
        item.ticket_type_restriction &&
        item.ticket_type_restriction.length > 0 &&
        !item.ticket_type_restriction.includes(ticketTypeId)
      ) {
        return { error: `${item.name} is not available for your ticket type.` }
      }
    }
    merchandiseItems = merch as MerchRow[]
  }

  // 5. Acquire soft locks for finite-count resources
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Ticket lock
  if (ticketType.available_count !== null) {
    await supabase.from('locks').delete()
      .eq('resource_type', 'ticket').eq('resource_id', ticketTypeId).lt('expires_at', now)

    const { count: activeLocks } = await supabase.from('locks')
      .select('*', { count: 'exact', head: true })
      .eq('resource_type', 'ticket').eq('resource_id', ticketTypeId).gte('expires_at', now)

    const { count: completePurchases } = await supabase.from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('ticket_type_id', ticketTypeId).eq('ticket_status', 'Complete')

    if ((activeLocks ?? 0) + (completePurchases ?? 0) >= ticketType.available_count) {
      return { error: 'This ticket type is sold out.' }
    }
    const { error: lockErr } = await supabase.from('locks').insert({
      resource_type: 'ticket', resource_id: ticketTypeId, locked_by: user.id, expires_at: expiresAt,
    })
    if (lockErr) return { error: 'Failed to reserve ticket. Please try again.' }
  }

  // Merchandise locks
  for (const item of merchandiseItems) {
    if (item.available_count !== null) {
      await supabase.from('locks').delete()
        .eq('resource_type', 'merchandise').eq('resource_id', item.id).lt('expires_at', now)

      const { count: activeLocks } = await supabase.from('locks')
        .select('*', { count: 'exact', head: true })
        .eq('resource_type', 'merchandise').eq('resource_id', item.id).gte('expires_at', now)

      // Count via order_items since merchandise can be purchased across events
      const { count: soldCount } = await supabase.from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('item_type', 'merchandise').eq('item_id', item.id)

      if ((activeLocks ?? 0) + (soldCount ?? 0) >= item.available_count) {
        await supabase.from('locks').delete().eq('locked_by', user.id)
        return { error: `${item.name} is sold out.` }
      }
      await supabase.from('locks').insert({
        resource_type: 'merchandise', resource_id: item.id, locked_by: user.id, expires_at: expiresAt,
      })
    }
  }

  // Volunteer shift locks
  for (const shiftId of effectiveShiftIds) {
    const { data: shift } = await supabase.from('volunteer_shifts')
      .select('capacity').eq('id', shiftId).single()
    if (!shift) {
      // Shift validated in step 3; if missing here something changed — abort
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'A selected shift is no longer available.' }
    }

    await supabase.from('locks').delete()
      .eq('resource_type', 'shift').eq('resource_id', shiftId).lt('expires_at', now)

    const { count: activeLocks } = await supabase.from('locks')
      .select('*', { count: 'exact', head: true })
      .eq('resource_type', 'shift').eq('resource_id', shiftId).gte('expires_at', now)

    const { count: confirmedCount } = await supabase.from('user_volunteer_signups')
      .select('*', { count: 'exact', head: true })
      .eq('shift_id', shiftId).eq('status', 'confirmed')

    if ((activeLocks ?? 0) + (confirmedCount ?? 0) >= shift.capacity) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'One of your selected shifts is full. Please choose a different shift.' }
    }
    await supabase.from('locks').insert({
      resource_type: 'shift', resource_id: shiftId, locked_by: user.id, expires_at: expiresAt,
    })
  }

  // 5.5. Validate roommate code and acquire room soft-lock (if provided)
  // Admin client used for cross-user data queries — RLS blocks regular users from reading
  // other users' event_attendees rows, rooms, event_room_config, and bed_blocks.
  const admin = createAdminClient()
  let confirmedRoomId: string | null = null
  if (roommateCode && !ticketType.room_lead) {
    const code = roommateCode.toUpperCase().trim()

    // Look up Room Lead attendee by code
    const { data: leadAttendee } = await admin
      .from('event_attendees')
      .select('user_id, room_id, is_room_lead')
      .eq('event_id', eventId)
      .eq('roommate_code', code)
      .eq('is_room_lead', true)
      .single()

    if (!leadAttendee?.room_id) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'This code is no longer valid. Please try again or skip.' }
    }

    const roomId = leadAttendee.room_id

    // Check room is not blocked/reserved
    const { data: roomConfig } = await admin
      .from('event_room_config')
      .select('blocked, reserved')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .maybeSingle()

    if (roomConfig?.blocked || roomConfig?.reserved) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'This code is no longer valid. Please try again or skip.' }
    }

    // Acquire room soft-lock
    await supabase.from('locks').delete()
      .eq('resource_type', 'room').eq('resource_id', roomId).lt('expires_at', now)

    const { count: roomLocks } = await admin.from('locks')
      .select('*', { count: 'exact', head: true })
      .eq('resource_type', 'room').eq('resource_id', roomId).gte('expires_at', now)

    const { data: room } = await admin.from('rooms')
      .select('bed_spot_count').eq('id', roomId).single()

    const { count: bedBlocks } = await admin.from('bed_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('room_id', roomId)

    const { count: occupants } = await admin.from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('room_id', roomId)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])

    const available =
      (room?.bed_spot_count ?? 0) - (bedBlocks ?? 0) - (occupants ?? 0) - (roomLocks ?? 0)

    if (available <= 0) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'Room is no longer available. Please try a different code or proceed without one.' }
    }

    const { error: roomLockErr } = await supabase.from('locks').insert({
      resource_type: 'room', resource_id: roomId, locked_by: user.id, expires_at: expiresAt,
    })
    if (roomLockErr) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      return { error: 'Failed to reserve room spot. Please try again.' }
    }

    confirmedRoomId = roomId
  }

  // 6. Calculate subtotal
  const ticketPrice = Number(ticketType.price)
  const subtotal = ticketPrice + merchandiseItems.reduce((sum, m) => sum + Number(m.price), 0)

  // 6.5. Resolve EP's payment provider (locks provider at transaction time per spec)
  const epProvider = await getEpPaymentProvider(eventId)
  const resolvedProvider = paymentToken?.provider ?? epProvider

  // 7. Create order (pending) — orders.id is the Square idempotency key (CLAUDE.md §4)
  const { data: order, error: orderError } = await supabase.from('orders').insert({
    event_id: eventId,
    user_id: user.id,
    payment_provider: resolvedProvider,
    status: 'pending',
    subtotal,
  }).select('id').single()
  if (orderError || !order) {
    await supabase.from('locks').delete().eq('locked_by', user.id)
    return { error: 'Failed to create order. Please try again.' }
  }
  const orderId: string = order.id

  // 8. Create order items
  const orderItems = [
    { order_id: orderId, item_type: 'ticket', item_id: ticketTypeId, quantity: 1, unit_price: ticketPrice },
    ...merchandiseItems.map(m => ({
      order_id: orderId, item_type: 'merchandise', item_id: m.id, quantity: 1, unit_price: Number(m.price),
    })),
  ]
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
  if (itemsError) {
    await supabase.from('locks').delete().eq('locked_by', user.id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return { error: 'Failed to record order. Please try again.' }
  }

  // 8.5. Process payment (skipped for $0 orders — seed data and free tickets work unchanged)
  if (subtotal > 0) {
    if (!paymentToken) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      return { error: 'Payment information is required.' }
    }
    const provider = getPaymentProvider(paymentToken.provider)
    const amountCents = Math.round(subtotal * 100)
    const paymentResult = await provider.createPayment({
      orderId,
      amountCents,
      currency: 'USD',
      nonce: paymentToken.provider === 'square' ? paymentToken.nonce : undefined,
      paypalOrderId: paymentToken.provider === 'paypal' ? paymentToken.paypalOrderId : undefined,
    })
    if (!paymentResult.success) {
      await supabase.from('locks').delete().eq('locked_by', user.id)
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      return { error: paymentResult.error ?? 'Payment failed. Please try again.' }
    }
    await supabase.from('orders')
      .update({ payment_transaction_id: paymentResult.transactionId })
      .eq('id', orderId)
  }

  // 9. Mark order complete
  await supabase.from('orders')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', orderId)

  // 10. Update attendee record
  await supabase.from('event_attendees').update({
    ticket_status: 'Complete',
    ticket_type_id: ticketTypeId,
    order_id: orderId,
    ticket_purchased_at: new Date().toISOString(),
    is_room_lead: ticketType.room_lead,
    volunteer_hours_required: ticketType.volunteer_hours_required,
  }).eq('event_id', eventId).eq('user_id', user.id)

  // 10.5. Assign room via Roommate Code (if provided and validated)
  if (confirmedRoomId) {
    await supabase.from('event_attendees').update({
      room_id: confirmedRoomId,
      room_status: 'Selected',
    }).eq('event_id', eventId).eq('user_id', user.id)
  }

  // 10.6. Generate and assign Roommate Code for Room Lead purchasers
  let generatedRoommateCode: string | undefined
  if (ticketType.room_lead && ticketType.roommate_codes_enabled) {
    let code: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoommateCode()
      // Check uniqueness — partial unique index on non-null roommate_code values
      const { data: existing } = await admin
        .from('event_attendees')
        .select('id')
        .eq('roommate_code', candidate)
        .maybeSingle()
      if (!existing) {
        code = candidate
        break
      }
    }
    if (code) {
      await supabase.from('event_attendees').update({ roommate_code: code })
        .eq('event_id', eventId).eq('user_id', user.id)
      generatedRoommateCode = code
    }
    // If all 5 attempts collide (astronomically unlikely), skip silently — code can be assigned manually
  }

  // 11. Insert volunteer signups (confirmed)
  if (effectiveShiftIds.length > 0) {
    await supabase.from('user_volunteer_signups').insert(
      effectiveShiftIds.map(shiftId => ({
        event_id: eventId,
        user_id: user.id,
        shift_id: shiftId,
        status: 'confirmed',
      }))
    )
  }

  // 12. Release all soft locks held by this user
  await supabase.from('locks').delete().eq('locked_by', user.id)

  // 13. Notifications
  // Fetch event title and buyer display name for notification bodies
  const [{ data: eventRowTicket }, { data: buyerProfile }] = await Promise.all([
    admin.from('platform_events').select('title').eq('id', eventId).single(),
    admin.from('platform_users').select('preferred_scene_name, email').eq('id', user.id).single(),
  ])
  const ticketEventTitle = eventRowTicket?.title ?? 'the event'
  const buyerName = buyerProfile?.preferred_scene_name?.trim()
    || (buyerProfile?.email?.split('@')[0] ?? 'A user')

  // Row 15: ticket purchased → user (in-platform + email)
  void createInPlatformNotification({
    userId: user.id,
    type: 'ticket_purchased',
    title: 'Ticket confirmed',
    body: `Your ticket for ${ticketEventTitle} is confirmed.`,
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event Hub',
    eventId,
  })
  // Row 32: roommate code used — notify Room Lead when a roommate is placed via code
  if (confirmedRoomId) {
    const { data: roomLeadRow } = await admin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('room_id', confirmedRoomId)
      .eq('is_room_lead', true)
      .limit(1)
      .single()

    if (roomLeadRow) {
      const row32Body = `${buyerName} used your Roommate Code and has been placed in your room for ${ticketEventTitle}.`
      void createInPlatformNotification({
        userId: roomLeadRow.user_id,
        type: 'roommate_code_used',
        title: 'Roommate joined your room',
        body: row32Body,
        actionUrl: `/events/${eventId}/rooms/${confirmedRoomId}`,
        actionLabel: 'Manage Room',
        eventId,
      })
      // Row 32: Telegram to Room Lead
      const { data: roomLeadTg32 } = await admin
        .from('platform_users')
        .select('telegram_handle, telegram_verified, telegram_notifications_enabled')
        .eq('id', roomLeadRow.user_id)
        .single()
      if (roomLeadTg32?.telegram_handle && roomLeadTg32.telegram_verified && roomLeadTg32.telegram_notifications_enabled) {
        void sendTelegramMessage(roomLeadTg32.telegram_handle, row32Body)
      }
    }
  }

  return { success: true, orderId, ...(generatedRoommateCode ? { roommate_code: generatedRoommateCode } : {}) }
}

// ── Self-cancellation (user-initiated, pre-lock) ─────────────────────────────

export async function selfCancelTicket(
  eventId: string,
): Promise<{ success: true; refundAmount: number } | { error: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, lock_status, order_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.ticket_status !== 'Complete') return { error: 'You do not have an active ticket.' }
  if (attendee.lock_status === 'Locked') {
    return { error: 'Your attendance is locked — self-cancellation is not permitted. Contact the Event Promoter.' }
  }
  if (!attendee.order_id) return { error: 'Order record not found.' }

  // Fetch order
  const { data: order } = await admin
    .from('orders')
    .select('payment_transaction_id, subtotal, payment_provider, status')
    .eq('id', attendee.order_id)
    .single()

  if (!order) return { error: 'Order not found.' }
  if (order.status === 'refunded') return { error: 'This order has already been refunded.' }

  // Fetch cancellation policy
  const { data: event } = await admin
    .from('platform_events')
    .select('cancellation_policy, workflow_statuses, status, title')
    .eq('id', eventId)
    .single()

  // Calculate applicable refund percentage
  // Find the highest-order workflow status the event has already reached
  let refundPercentage = 0
  if (event?.cancellation_policy) {
    const policy = event.cancellation_policy as {
      checkpoints: { status_id: string; refund_percentage: number }[]
    }
    const workflowStatuses = (event.workflow_statuses ?? []) as {
      id: string; name: string; order: number
    }[]

    // Build a map of status UUID → order index
    const statusOrderMap = new Map(workflowStatuses.map(s => [s.id, s.order]))

    // Find the current event status order (system-fixed statuses use name, not UUID)
    // Walk checkpoints from highest order to lowest; use the first checkpoint whose
    // status the event has already passed or reached
    const sortedCheckpoints = [...policy.checkpoints].sort((a, b) => {
      const aOrder = statusOrderMap.get(a.status_id) ?? -1
      const bOrder = statusOrderMap.get(b.status_id) ?? -1
      return bOrder - aOrder // descending — highest status first
    })

    // For now: use the last checkpoint's percentage as a conservative default if we
    // can't resolve the current status. A proper implementation compares event.status
    // to workflow_statuses order to find the most-recently-passed checkpoint.
    if (sortedCheckpoints.length > 0) {
      // Use the first (highest-reached) checkpoint as the applicable policy.
      // In a full implementation this would compare against the current event status order.
      refundPercentage = sortedCheckpoints[sortedCheckpoints.length - 1].refund_percentage
    }
  }

  const subtotal = Number(order.subtotal)
  const refundAmountDollars = parseFloat(
    (Math.round(subtotal * refundPercentage) / 100).toFixed(2)
  )
  const refundCents = Math.round(refundAmountDollars * 100)

  // Issue refund if payment was actually charged and there's an amount to refund
  if (refundCents > 0 && order.payment_transaction_id) {
    const provider = getPaymentProvider(
      order.payment_provider as 'square' | 'paypal'
    )
    const refundResult = await provider.refundPayment({
      transactionId: order.payment_transaction_id,
      amountCents: refundCents,
      orderId: attendee.order_id,
    })
    if (!refundResult.success) {
      return { error: refundResult.error ?? 'Refund failed. Please contact support.' }
    }
  }

  // Update order status
  await admin.from('orders').update({
    status: refundCents >= Math.round(subtotal * 100) ? 'refunded' : 'partial_refund',
    amount_refunded: refundAmountDollars,
  }).eq('id', attendee.order_id)

  // Reset ticket status on attendee record
  await supabase.from('event_attendees').update({
    ticket_status: 'Incomplete',
    order_id: null,
    ticket_type_id: null,
    ticket_purchased_at: null,
    is_room_lead: false,
  }).eq('event_id', eventId).eq('user_id', user.id)

  // Row 16: refund processed → notify attendee (in-platform + email)
  // TODO: send email to attendee: refund amount, event name, original order ID
  const cancelEventTitle = event?.title ?? 'the event'
  void createInPlatformNotification({
    userId: user.id,
    type: 'refund_processed',
    title: 'Refund processed',
    body: refundCents > 0
      ? `A refund of $${refundAmountDollars.toFixed(2)} for ${cancelEventTitle} has been initiated.`
      : `Your ticket for ${cancelEventTitle} has been cancelled. No refund applies per the cancellation policy.`,
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event Hub',
    eventId,
  })

  revalidatePath(`/events/${eventId}`)
  return { success: true, refundAmount: refundAmountDollars }
}
