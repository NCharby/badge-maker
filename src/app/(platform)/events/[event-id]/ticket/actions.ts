'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function purchaseTicket(
  eventId: string,
  ticketTypeId: string,
  shiftIds: string[],       // empty if no volunteer hours required
  merchandiseIds: string[], // empty if no merchandise selected
): Promise<{ success: true; orderId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Attendee guard
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()
  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.ticket_status === 'Complete') return { error: 'You already have a ticket for this event.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked — no further changes can be made.' }

  // 2. Ticket type guard — must belong to this event
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id, name, price, available_count, room_lead, volunteer_hours_required, room_required_at_purchase')
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

  // 6. Calculate subtotal
  const ticketPrice = Number(ticketType.price)
  const subtotal = ticketPrice + merchandiseItems.reduce((sum, m) => sum + Number(m.price), 0)

  // 7. Create order (pending)
  // orders.id is used as the Square idempotency key (CLAUDE.md §4)
  const { data: order, error: orderError } = await supabase.from('orders').insert({
    event_id: eventId,
    user_id: user.id,
    payment_provider: 'square', // stub — no payment API called in Step 5
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
    return { error: 'Failed to record order. Please try again.' }
  }

  // 9. Complete order immediately ($0 / no payment in Step 5)
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

  // 13. Notification stub — row #15 (ticket purchased → user email)
  console.log(`[notification] ticket purchased: user=${user.id} event=${eventId} order=${orderId}`)

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/ticket`)
  return { success: true, orderId }
}
