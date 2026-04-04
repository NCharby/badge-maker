import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FinancialSummary,
  TicketRevenueRow,
  MerchandiseRevenueRow,
  AttendeeBreakdownRow,
  TicketCapacityRow,
  VolunteerStats,
  ApplicationStats,
  RefundByChannel,
  RevenueTrendPoint,
  TopEventRow,
  TopOrgRow,
  FunnelStep,
  RetentionRow,
  OrgOperationalBreakdowns,
} from './types'

// ── Event-Level Queries ───────────────────────────────────────────────────

export async function getEventFinancialSummary(
  admin: SupabaseClient,
  eventId: string,
): Promise<FinancialSummary> {
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, subtotal, amount_refunded')
    .eq('event_id', eventId)

  const rows = orders ?? []

  const completed = rows.filter(o => o.status === 'complete' || o.status === 'partial_refund')
  const cancelled = rows.filter(o => o.status === 'cancelled')
  const refunded = rows.filter(o => o.status === 'refunded')

  const totalIncome = completed.reduce((s, o) => s + Number(o.subtotal), 0)
    + refunded.reduce((s, o) => s + Number(o.subtotal), 0)
  const totalRefunds = rows.reduce((s, o) => s + Number(o.amount_refunded), 0)
  const totalCancellations = cancelled.reduce((s, o) => s + Number(o.subtotal), 0)

  return {
    totalIncome,
    totalRefunds,
    totalCancellations,
    netRevenue: totalIncome - totalRefunds,
    orderCount: completed.length + refunded.length,
    refundCount: rows.filter(o => Number(o.amount_refunded) > 0).length,
    cancelledCount: cancelled.length,
  }
}

export async function getEventTicketRevenue(
  admin: SupabaseClient,
  eventId: string,
): Promise<TicketRevenueRow[]> {
  // Fetch ticket types for this event
  const { data: ticketTypes } = await admin
    .from('ticket_types')
    .select('id, name, price, available_count')
    .eq('event_id', eventId)

  // Fetch completed order items of type 'ticket'
  const { data: orderItems } = await admin
    .from('order_items')
    .select('item_id, quantity, unit_price, amount_refunded, orders!inner(event_id, status)')
    .eq('orders.event_id', eventId)
    .eq('item_type', 'ticket')
    .in('orders.status', ['complete', 'partial_refund', 'refunded'])

  const types = ticketTypes ?? []
  const items = orderItems ?? []

  // Count attendees per ticket type
  const { data: attendees } = await admin
    .from('event_attendees')
    .select('ticket_type_id')
    .eq('event_id', eventId)
    .eq('ticket_status', 'Complete')

  const attendeeCounts = new Map<string, number>()
  for (const a of attendees ?? []) {
    if (a.ticket_type_id) {
      attendeeCounts.set(a.ticket_type_id, (attendeeCounts.get(a.ticket_type_id) ?? 0) + 1)
    }
  }

  const totalIssued = Array.from(attendeeCounts.values()).reduce((s, c) => s + c, 0)

  return types.map(tt => {
    const typeItems = items.filter((i: { item_id: string }) => i.item_id === tt.id)
    const gross = typeItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
    const refunded = typeItems.reduce((s, i) => s + Number(i.amount_refunded), 0)
    const issued = attendeeCounts.get(tt.id) ?? 0

    return {
      ticketTypeId: tt.id,
      name: tt.name,
      price: Number(tt.price),
      issuedCount: issued,
      pctOfTotal: totalIssued > 0 ? issued / totalIssued : 0,
      grossRevenue: gross,
      refundedAmount: refunded,
      netRevenue: gross - refunded,
      availableCount: tt.available_count,
      isSoldOut: tt.available_count !== null && issued >= tt.available_count,
    }
  })
}

export async function getEventMerchandiseRevenue(
  admin: SupabaseClient,
  eventId: string,
): Promise<MerchandiseRevenueRow[]> {
  const { data: merchandise } = await admin
    .from('merchandise')
    .select('id, name, price, available_count, enabled')
    .eq('event_id', eventId)

  const { data: orderItems } = await admin
    .from('order_items')
    .select('item_id, quantity, unit_price, amount_refunded, orders!inner(event_id, status)')
    .eq('orders.event_id', eventId)
    .eq('item_type', 'merchandise')
    .in('orders.status', ['complete', 'partial_refund', 'refunded'])

  const items = orderItems ?? []

  return (merchandise ?? []).map(m => {
    const mItems = items.filter((i: { item_id: string }) => i.item_id === m.id)
    const qty = mItems.reduce((s, i) => s + Number(i.quantity), 0)
    const gross = mItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
    const refunded = mItems.reduce((s, i) => s + Number(i.amount_refunded), 0)
    const isSoldOut = m.available_count !== null && qty >= m.available_count

    let status: 'Active' | 'Sold Out' | 'Ended' = 'Active'
    if (!m.enabled) status = 'Ended'
    else if (isSoldOut) status = 'Sold Out'

    return {
      merchandiseId: m.id,
      name: m.name,
      unitPrice: Number(m.price),
      qtySold: qty,
      grossRevenue: gross,
      refundedAmount: refunded,
      netRevenue: gross - refunded,
      availableCount: m.available_count,
      enabled: m.enabled,
      status,
    }
  })
}

export async function getEventAttendeeBreakdown(
  admin: SupabaseClient,
  eventId: string,
): Promise<AttendeeBreakdownRow[]> {
  const { data: attendees } = await admin
    .from('event_attendees')
    .select('ticket_type_id, is_room_lead, ticket_types!inner(name)')
    .eq('event_id', eventId)
    .eq('ticket_status', 'Complete')

  const rows = attendees ?? []
  const total = rows.length

  const grouped = new Map<string, { count: number; isRoomLead: boolean }>()
  for (const a of rows) {
    const ttData = a as unknown as { ticket_types: { name: string } }
    const name = ttData.ticket_types?.name ?? 'Unknown'
    const existing = grouped.get(name) ?? { count: 0, isRoomLead: false }
    existing.count += 1
    if (a.is_room_lead) existing.isRoomLead = true
    grouped.set(name, existing)
  }

  return Array.from(grouped.entries()).map(([name, data]) => ({
    ticketTypeName: name,
    count: data.count,
    pctOfTotal: total > 0 ? data.count / total : 0,
    isRoomLead: data.isRoomLead,
  }))
}

export async function getEventTicketCapacity(
  admin: SupabaseClient,
  eventId: string,
): Promise<TicketCapacityRow[]> {
  const { data: ticketTypes } = await admin
    .from('ticket_types')
    .select('id, name, price, available_count')
    .eq('event_id', eventId)

  const { data: attendees } = await admin
    .from('event_attendees')
    .select('ticket_type_id')
    .eq('event_id', eventId)
    .eq('ticket_status', 'Complete')

  const issuedMap = new Map<string, number>()
  for (const a of attendees ?? []) {
    if (a.ticket_type_id) {
      issuedMap.set(a.ticket_type_id, (issuedMap.get(a.ticket_type_id) ?? 0) + 1)
    }
  }

  return (ticketTypes ?? []).map(tt => {
    const issued = issuedMap.get(tt.id) ?? 0
    const remaining = tt.available_count !== null ? tt.available_count - issued : null
    const fillPct = tt.available_count !== null && tt.available_count > 0
      ? issued / tt.available_count
      : null

    return {
      ticketTypeId: tt.id,
      name: tt.name,
      price: Number(tt.price),
      availableCount: tt.available_count,
      issuedCount: issued,
      remainingCount: remaining,
      fillPct,
      isSoldOut: remaining !== null && remaining <= 0,
    }
  })
}

export async function getEventVolunteerStats(
  admin: SupabaseClient,
  eventId: string,
): Promise<VolunteerStats> {
  const { data: shifts } = await admin
    .from('volunteer_shifts')
    .select('id, capacity, duration_minutes')
    .eq('event_id', eventId)

  const { data: signups } = await admin
    .from('user_volunteer_signups')
    .select('status, shift_id')
    .eq('event_id', eventId)

  const shiftRows = shifts ?? []
  const signupRows = signups ?? []
  const totalCapacity = shiftRows.reduce((s, sh) => s + sh.capacity, 0)
  const confirmed = signupRows.filter(s => s.status === 'confirmed')
  const noShows = signupRows.filter(s => s.status === 'no_show')

  // Hours pledged = sum of shift duration for confirmed signups
  const shiftDurations = new Map(shiftRows.map(s => [s.id, s.duration_minutes]))
  const totalMinutes = confirmed.reduce((s, su) => s + (shiftDurations.get(su.shift_id) ?? 0), 0)

  return {
    totalShifts: shiftRows.length,
    totalCapacity,
    confirmedSignups: confirmed.length,
    fillRate: totalCapacity > 0 ? confirmed.length / totalCapacity : 0,
    noShowCount: noShows.length,
    totalHoursPledged: Math.round((totalMinutes / 60) * 10) / 10,
  }
}

export async function getEventApplicationStats(
  admin: SupabaseClient,
  eventId: string,
): Promise<ApplicationStats> {
  const { data: attendees } = await admin
    .from('event_attendees')
    .select('application_status')
    .eq('event_id', eventId)

  const rows = attendees ?? []
  const counts = {
    incomplete: 0, inProgress: 0, needsReview: 0,
    completed: 0, approved: 0, declined: 0, closed: 0,
  }

  for (const a of rows) {
    switch (a.application_status) {
      case 'Incomplete': counts.incomplete++; break
      case 'In Progress': counts.inProgress++; break
      case 'Needs Review': counts.needsReview++; break
      case 'Completed': counts.completed++; break
      case 'Approved': counts.approved++; break
      case 'Declined': counts.declined++; break
      case 'Closed': counts.closed++; break
    }
  }

  const submitted = counts.needsReview + counts.completed + counts.approved + counts.declined + counts.closed
  return {
    ...counts,
    approvalRate: submitted > 0 ? counts.approved / submitted : 0,
  }
}

export async function getEventRefundsByChannel(
  admin: SupabaseClient,
  eventId: string,
): Promise<RefundByChannel[]> {
  const { data: orders } = await admin
    .from('orders')
    .select('amount_refunded, refund_channel')
    .eq('event_id', eventId)
    .gt('amount_refunded', 0)

  const grouped = new Map<string, { amount: number; count: number }>()
  for (const o of orders ?? []) {
    const channel = o.refund_channel ?? 'standard'
    const existing = grouped.get(channel) ?? { amount: 0, count: 0 }
    existing.amount += Number(o.amount_refunded)
    existing.count += 1
    grouped.set(channel, existing)
  }

  return Array.from(grouped.entries()).map(([channel, data]) => ({
    channel,
    amount: data.amount,
    count: data.count,
  }))
}

// ── Org-Level Queries ─────────────────────────────────────────────────────

export async function getOrgFinancialSummary(
  admin: SupabaseClient,
  orgId: string,
  sinceDate?: string,
): Promise<FinancialSummary> {
  let query = admin
    .from('orders')
    .select('id, status, subtotal, amount_refunded, platform_events!inner(organization_id)')
    .eq('platform_events.organization_id', orgId)
  if (sinceDate) query = query.gte('completed_at', sinceDate)
  const { data: orders } = await query

  const rows = orders ?? []

  const completed = rows.filter(o => o.status === 'complete' || o.status === 'partial_refund')
  const cancelled = rows.filter(o => o.status === 'cancelled')
  const refunded = rows.filter(o => o.status === 'refunded')

  const totalIncome = completed.reduce((s, o) => s + Number(o.subtotal), 0)
    + refunded.reduce((s, o) => s + Number(o.subtotal), 0)
  const totalRefunds = rows.reduce((s, o) => s + Number(o.amount_refunded), 0)
  const totalCancellations = cancelled.reduce((s, o) => s + Number(o.subtotal), 0)

  return {
    totalIncome,
    totalRefunds,
    totalCancellations,
    netRevenue: totalIncome - totalRefunds,
    orderCount: completed.length + refunded.length,
    refundCount: rows.filter(o => Number(o.amount_refunded) > 0).length,
    cancelledCount: cancelled.length,
  }
}

export async function getOrgRevenueTrend(
  admin: SupabaseClient,
  orgId: string,
  days: number,
): Promise<RevenueTrendPoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: orders } = await admin
    .from('orders')
    .select('subtotal, amount_refunded, completed_at, platform_events!inner(organization_id)')
    .eq('platform_events.organization_id', orgId)
    .in('status', ['complete', 'partial_refund', 'refunded'])
    .gte('completed_at', since.toISOString())
    .order('completed_at')

  const byDay = new Map<string, number>()
  for (const o of orders ?? []) {
    if (!o.completed_at) continue
    const day = o.completed_at.slice(0, 10) // YYYY-MM-DD
    const net = Number(o.subtotal) - Number(o.amount_refunded)
    byDay.set(day, (byDay.get(day) ?? 0) + net)
  }

  return Array.from(byDay.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getOrgTopEventsByRevenue(
  admin: SupabaseClient,
  orgId: string,
  limit: number = 5,
): Promise<TopEventRow[]> {
  const { data: events } = await admin
    .from('platform_events')
    .select('id, title, start_date')
    .eq('organization_id', orgId)
    .order('start_date', { ascending: false })

  const results: TopEventRow[] = []
  for (const evt of events ?? []) {
    const { data: orders } = await admin
      .from('orders')
      .select('subtotal, amount_refunded, status')
      .eq('event_id', evt.id)
      .in('status', ['complete', 'partial_refund', 'refunded'])

    const netRevenue = (orders ?? []).reduce(
      (s, o) => s + Number(o.subtotal) - Number(o.amount_refunded), 0
    )

    const { count } = await admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', evt.id)
      .eq('ticket_status', 'Complete')

    results.push({
      eventId: evt.id,
      title: evt.title,
      startDate: evt.start_date,
      attendeeCount: count ?? 0,
      netRevenue,
    })
  }

  return results
    .sort((a, b) => b.netRevenue - a.netRevenue || b.startDate.localeCompare(a.startDate))
    .slice(0, limit)
}

export async function getOrgRegistrationFunnel(
  admin: SupabaseClient,
  orgId: string,
): Promise<FunnelStep[]> {
  const { data: events } = await admin
    .from('platform_events')
    .select('id')
    .eq('organization_id', orgId)

  const eventIds = (events ?? []).map(e => e.id)
  if (eventIds.length === 0) {
    return [
      { label: 'Applied', count: 0, pct: 0 },
      { label: 'Approved', count: 0, pct: 0 },
      { label: 'Ticketed', count: 0, pct: 0 },
      { label: 'Locked', count: 0, pct: 0 },
    ]
  }

  const { data: attendees } = await admin
    .from('event_attendees')
    .select('application_status, ticket_status, lock_status')
    .in('event_id', eventIds)

  const rows = attendees ?? []
  const applied = rows.filter(a =>
    a.application_status !== 'Incomplete' && a.application_status !== 'In Progress'
  ).length
  const approved = rows.filter(a => a.application_status === 'Approved').length
  const ticketed = rows.filter(a => a.ticket_status === 'Complete').length
  const locked = rows.filter(a => a.lock_status === 'Locked').length

  const top = applied || 1
  return [
    { label: 'Applied', count: applied, pct: 1 },
    { label: 'Approved', count: approved, pct: approved / top },
    { label: 'Ticketed', count: ticketed, pct: ticketed / top },
    { label: 'Locked', count: locked, pct: locked / top },
  ]
}

export async function getOrgAttendeeRetention(
  admin: SupabaseClient,
  orgId: string,
): Promise<RetentionRow[]> {
  const { data: events } = await admin
    .from('platform_events')
    .select('id, title, start_date')
    .eq('organization_id', orgId)
    .order('start_date', { ascending: true })

  const evts = events ?? []
  if (evts.length === 0) return []

  const { data: allAttendees } = await admin
    .from('event_attendees')
    .select('event_id, user_id')
    .in('event_id', evts.map(e => e.id))
    .eq('ticket_status', 'Complete')

  // Build map: eventId -> Set of user_ids
  const eventUsers = new Map<string, Set<string>>()
  for (const a of allAttendees ?? []) {
    const set = eventUsers.get(a.event_id) ?? new Set()
    set.add(a.user_id)
    eventUsers.set(a.event_id, set)
  }

  const now = new Date()
  return evts.map((evt, idx) => {
    const users = eventUsers.get(evt.id) ?? new Set()
    const isUpcoming = new Date(evt.start_date + 'T00:00:00') > now

    if (isUpcoming || idx === evts.length - 1) {
      return {
        eventId: evt.id,
        title: evt.title,
        startDate: evt.start_date,
        attendeeCount: users.size,
        returnedCount: null,
        retentionPct: null,
      }
    }

    // Count users who appeared in any later event
    const laterEventIds = evts.slice(idx + 1).map(e => e.id)
    const laterUsers = new Set<string>()
    for (const laterId of laterEventIds) {
      const laterSet = eventUsers.get(laterId)
      if (laterSet) laterSet.forEach(uid => laterUsers.add(uid))
    }

    let returned = 0
    users.forEach(uid => {
      if (laterUsers.has(uid)) returned++
    })

    return {
      eventId: evt.id,
      title: evt.title,
      startDate: evt.start_date,
      attendeeCount: users.size,
      returnedCount: returned,
      retentionPct: users.size > 0 ? returned / users.size : null,
    }
  })
}

export async function getOrgOperationalBreakdowns(
  admin: SupabaseClient,
  orgId: string,
): Promise<OrgOperationalBreakdowns> {
  const { data: events } = await admin
    .from('platform_events')
    .select('id')
    .eq('organization_id', orgId)

  const eventIds = (events ?? []).map(e => e.id)

  // Applications
  let applications: ApplicationStats = {
    incomplete: 0, inProgress: 0, needsReview: 0,
    completed: 0, approved: 0, declined: 0, closed: 0, approvalRate: 0,
  }
  if (eventIds.length > 0) {
    const { data: attendees } = await admin
      .from('event_attendees')
      .select('application_status')
      .in('event_id', eventIds)

    for (const a of attendees ?? []) {
      switch (a.application_status) {
        case 'Incomplete': applications.incomplete++; break
        case 'In Progress': applications.inProgress++; break
        case 'Needs Review': applications.needsReview++; break
        case 'Completed': applications.completed++; break
        case 'Approved': applications.approved++; break
        case 'Declined': applications.declined++; break
        case 'Closed': applications.closed++; break
      }
    }
    const submitted = applications.needsReview + applications.completed + applications.approved + applications.declined + applications.closed
    applications.approvalRate = submitted > 0 ? applications.approved / submitted : 0
  }

  // Volunteers
  let volunteers: VolunteerStats = {
    totalShifts: 0, totalCapacity: 0, confirmedSignups: 0,
    fillRate: 0, noShowCount: 0, totalHoursPledged: 0,
  }
  if (eventIds.length > 0) {
    const { data: shifts } = await admin
      .from('volunteer_shifts')
      .select('id, capacity, duration_minutes')
      .in('event_id', eventIds)

    const { data: signups } = await admin
      .from('user_volunteer_signups')
      .select('status, shift_id')
      .in('event_id', eventIds)

    const shiftRows = shifts ?? []
    const signupRows = signups ?? []
    const totalCap = shiftRows.reduce((s, sh) => s + sh.capacity, 0)
    const confirmed = signupRows.filter(s => s.status === 'confirmed')
    const noShows = signupRows.filter(s => s.status === 'no_show')
    const shiftDurations = new Map(shiftRows.map(s => [s.id, s.duration_minutes]))
    const totalMinutes = confirmed.reduce((s, su) => s + (shiftDurations.get(su.shift_id) ?? 0), 0)

    volunteers = {
      totalShifts: shiftRows.length,
      totalCapacity: totalCap,
      confirmedSignups: confirmed.length,
      fillRate: totalCap > 0 ? confirmed.length / totalCap : 0,
      noShowCount: noShows.length,
      totalHoursPledged: Math.round((totalMinutes / 60) * 10) / 10,
    }
  }

  // Refunds
  const refunds = { totalAmount: 0, totalCount: 0, refundRate: 0, byChannel: [] as RefundByChannel[] }
  if (eventIds.length > 0) {
    const { data: orders } = await admin
      .from('orders')
      .select('subtotal, amount_refunded, refund_channel, status')
      .in('event_id', eventIds)

    const allOrders = orders ?? []
    const grossIncome = allOrders
      .filter(o => o.status === 'complete' || o.status === 'partial_refund' || o.status === 'refunded')
      .reduce((s, o) => s + Number(o.subtotal), 0)

    const refundedOrders = allOrders.filter(o => Number(o.amount_refunded) > 0)
    refunds.totalAmount = refundedOrders.reduce((s, o) => s + Number(o.amount_refunded), 0)
    refunds.totalCount = refundedOrders.length
    refunds.refundRate = grossIncome > 0 ? refunds.totalAmount / grossIncome : 0

    const channelMap = new Map<string, { amount: number; count: number }>()
    for (const o of refundedOrders) {
      const ch = o.refund_channel ?? 'standard'
      const existing = channelMap.get(ch) ?? { amount: 0, count: 0 }
      existing.amount += Number(o.amount_refunded)
      existing.count += 1
      channelMap.set(ch, existing)
    }
    refunds.byChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel, amount: data.amount, count: data.count,
    }))
  }

  return { applications, volunteers, refunds }
}

// ── Platform-Level Queries (Admin) ────────────────────────────────────────

export async function getPlatformFinancialSummary(
  admin: SupabaseClient,
  sinceDate?: string,
): Promise<FinancialSummary> {
  let query = admin
    .from('orders')
    .select('id, status, subtotal, amount_refunded')
  if (sinceDate) query = query.gte('completed_at', sinceDate)
  const { data: orders } = await query

  const rows = orders ?? []
  const completed = rows.filter(o => o.status === 'complete' || o.status === 'partial_refund')
  const cancelled = rows.filter(o => o.status === 'cancelled')
  const refunded = rows.filter(o => o.status === 'refunded')

  const totalIncome = completed.reduce((s, o) => s + Number(o.subtotal), 0)
    + refunded.reduce((s, o) => s + Number(o.subtotal), 0)
  const totalRefunds = rows.reduce((s, o) => s + Number(o.amount_refunded), 0)
  const totalCancellations = cancelled.reduce((s, o) => s + Number(o.subtotal), 0)

  return {
    totalIncome,
    totalRefunds,
    totalCancellations,
    netRevenue: totalIncome - totalRefunds,
    orderCount: completed.length + refunded.length,
    refundCount: rows.filter(o => Number(o.amount_refunded) > 0).length,
    cancelledCount: cancelled.length,
  }
}

export async function getPlatformRevenueTrend(
  admin: SupabaseClient,
  days: number,
): Promise<RevenueTrendPoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: orders } = await admin
    .from('orders')
    .select('subtotal, amount_refunded, completed_at')
    .in('status', ['complete', 'partial_refund', 'refunded'])
    .gte('completed_at', since.toISOString())
    .order('completed_at')

  const byDay = new Map<string, number>()
  for (const o of orders ?? []) {
    if (!o.completed_at) continue
    const day = o.completed_at.slice(0, 10)
    const net = Number(o.subtotal) - Number(o.amount_refunded)
    byDay.set(day, (byDay.get(day) ?? 0) + net)
  }

  return Array.from(byDay.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getPlatformTopOrgs(
  admin: SupabaseClient,
  limit: number = 5,
): Promise<TopOrgRow[]> {
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name')
    .eq('archived', false)

  const results: TopOrgRow[] = []
  for (const org of orgs ?? []) {
    const { count: eventCount } = await admin
      .from('platform_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)

    const { data: orders } = await admin
      .from('orders')
      .select('subtotal, amount_refunded, platform_events!inner(organization_id)')
      .eq('platform_events.organization_id', org.id)
      .in('status', ['complete', 'partial_refund', 'refunded'])

    const netRevenue = (orders ?? []).reduce(
      (s, o) => s + Number(o.subtotal) - Number(o.amount_refunded), 0
    )

    results.push({
      orgId: org.id,
      name: org.name,
      eventCount: eventCount ?? 0,
      netRevenue,
    })
  }

  return results
    .sort((a, b) => b.netRevenue - a.netRevenue || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export async function getPlatformTopEvents(
  admin: SupabaseClient,
  limit: number = 5,
): Promise<TopEventRow[]> {
  const { data: events } = await admin
    .from('platform_events')
    .select('id, title, start_date')
    .order('start_date', { ascending: false })
    .limit(50) // candidate pool

  const results: TopEventRow[] = []
  for (const evt of events ?? []) {
    const { data: orders } = await admin
      .from('orders')
      .select('subtotal, amount_refunded')
      .eq('event_id', evt.id)
      .in('status', ['complete', 'partial_refund', 'refunded'])

    const netRevenue = (orders ?? []).reduce(
      (s, o) => s + Number(o.subtotal) - Number(o.amount_refunded), 0
    )

    const { count } = await admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', evt.id)
      .eq('ticket_status', 'Complete')

    results.push({
      eventId: evt.id,
      title: evt.title,
      startDate: evt.start_date,
      attendeeCount: count ?? 0,
      netRevenue,
    })
  }

  return results
    .sort((a, b) => b.netRevenue - a.netRevenue || b.startDate.localeCompare(a.startDate))
    .slice(0, limit)
}

export async function getPlatformRegistrationFunnel(
  admin: SupabaseClient,
): Promise<FunnelStep[]> {
  const { data: attendees } = await admin
    .from('event_attendees')
    .select('application_status, ticket_status, lock_status')

  const rows = attendees ?? []
  const applied = rows.filter(a =>
    a.application_status !== 'Incomplete' && a.application_status !== 'In Progress'
  ).length
  const approved = rows.filter(a => a.application_status === 'Approved').length
  const ticketed = rows.filter(a => a.ticket_status === 'Complete').length
  const locked = rows.filter(a => a.lock_status === 'Locked').length

  const top = applied || 1
  return [
    { label: 'Applied', count: applied, pct: 1 },
    { label: 'Approved', count: approved, pct: approved / top },
    { label: 'Ticketed', count: ticketed, pct: ticketed / top },
    { label: 'Locked', count: locked, pct: locked / top },
  ]
}

export async function getPlatformOperationalBreakdowns(
  admin: SupabaseClient,
): Promise<OrgOperationalBreakdowns> {
  const { data: allAttendees } = await admin
    .from('event_attendees')
    .select('application_status')

  const applications: ApplicationStats = {
    incomplete: 0, inProgress: 0, needsReview: 0,
    completed: 0, approved: 0, declined: 0, closed: 0, approvalRate: 0,
  }
  for (const a of allAttendees ?? []) {
    switch (a.application_status) {
      case 'Incomplete': applications.incomplete++; break
      case 'In Progress': applications.inProgress++; break
      case 'Needs Review': applications.needsReview++; break
      case 'Completed': applications.completed++; break
      case 'Approved': applications.approved++; break
      case 'Declined': applications.declined++; break
      case 'Closed': applications.closed++; break
    }
  }
  const submitted = applications.needsReview + applications.completed + applications.approved + applications.declined + applications.closed
  applications.approvalRate = submitted > 0 ? applications.approved / submitted : 0

  const { data: shifts } = await admin.from('volunteer_shifts').select('id, capacity, duration_minutes')
  const { data: signups } = await admin.from('user_volunteer_signups').select('status, shift_id')
  const shiftRows = shifts ?? []
  const signupRows = signups ?? []
  const totalCap = shiftRows.reduce((s, sh) => s + sh.capacity, 0)
  const confirmed = signupRows.filter(s => s.status === 'confirmed')
  const noShows = signupRows.filter(s => s.status === 'no_show')
  const shiftDurations = new Map(shiftRows.map(s => [s.id, s.duration_minutes]))
  const totalMinutes = confirmed.reduce((s, su) => s + (shiftDurations.get(su.shift_id) ?? 0), 0)

  const volunteers: VolunteerStats = {
    totalShifts: shiftRows.length,
    totalCapacity: totalCap,
    confirmedSignups: confirmed.length,
    fillRate: totalCap > 0 ? confirmed.length / totalCap : 0,
    noShowCount: noShows.length,
    totalHoursPledged: Math.round((totalMinutes / 60) * 10) / 10,
  }

  const { data: allOrders } = await admin.from('orders').select('subtotal, amount_refunded, refund_channel, status')
  const orderRows = allOrders ?? []
  const grossIncome = orderRows
    .filter(o => o.status === 'complete' || o.status === 'partial_refund' || o.status === 'refunded')
    .reduce((s, o) => s + Number(o.subtotal), 0)
  const refundedOrders = orderRows.filter(o => Number(o.amount_refunded) > 0)
  const refundTotalAmount = refundedOrders.reduce((s, o) => s + Number(o.amount_refunded), 0)
  const channelMap = new Map<string, { amount: number; count: number }>()
  for (const o of refundedOrders) {
    const ch = o.refund_channel ?? 'standard'
    const existing = channelMap.get(ch) ?? { amount: 0, count: 0 }
    existing.amount += Number(o.amount_refunded)
    existing.count += 1
    channelMap.set(ch, existing)
  }

  return {
    applications,
    volunteers,
    refunds: {
      totalAmount: refundTotalAmount,
      totalCount: refundedOrders.length,
      refundRate: grossIncome > 0 ? refundTotalAmount / grossIncome : 0,
      byChannel: Array.from(channelMap.entries()).map(([channel, data]) => ({
        channel, amount: data.amount, count: data.count,
      })),
    },
  }
}
