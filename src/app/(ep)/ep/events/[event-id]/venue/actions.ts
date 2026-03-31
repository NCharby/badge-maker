'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function updateEventVenue(
  eventId: string,
  venueId: string | null,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, module_config')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  if (!event) return { error: 'Access denied.' }

  // Sync module_config: if venueId set, ensure venue module present; if cleared, remove it
  const mc = (event.module_config ?? {}) as Record<string, unknown>
  if (venueId) {
    if (!mc.venue) {
      mc.venue = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
    }
  } else {
    delete mc.venue
  }

  const { error } = await supabase
    .from('platform_events')
    .update({ venue_id: venueId, module_config: mc })
    .eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  revalidatePath(`/ep/events/${eventId}`)
  return { success: true }
}

// ─── EP guard helper ──────────────────────────────────────────────────────────
// Returns the user ID if the caller owns the event (Block D) or is system_admin
// (Block B). Returns null if access is denied.
async function epGuard(eventId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: pu } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!pu) return null
  if (pu.role === 'system_admin') return user.id

  const { data: event } = await supabase
    .from('platform_events')
    .select('id')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()
  return event ? user.id : null
}

// ─── Room blocking ────────────────────────────────────────────────────────────

export async function epBlockRoom(
  eventId: string,
  roomId: string,
  note?: string,
): Promise<{ success: true } | { error: string }> {
  const userId = await epGuard(eventId)
  if (!userId) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('event_room_config').upsert({
    event_id: eventId,
    room_id: roomId,
    blocked: true,
    block_note: note ?? null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,room_id' })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

export async function epUnblockRoom(
  eventId: string,
  roomId: string,
): Promise<{ success: true } | { error: string }> {
  const userId = await epGuard(eventId)
  if (!userId) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('event_room_config').upsert({
    event_id: eventId,
    room_id: roomId,
    blocked: false,
    block_note: null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,room_id' })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

// ─── Room reservation ─────────────────────────────────────────────────────────

export async function epReserveRoom(
  eventId: string,
  roomId: string,
  note?: string,
  notePublic?: boolean,
): Promise<{ success: true } | { error: string }> {
  const userId = await epGuard(eventId)
  if (!userId) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('event_room_config').upsert({
    event_id: eventId,
    room_id: roomId,
    reserved: true,
    reservation_note: note ?? null,
    reservation_note_public: notePublic ?? false,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,room_id' })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

export async function epUnreserveRoom(
  eventId: string,
  roomId: string,
): Promise<{ success: true } | { error: string }> {
  const userId = await epGuard(eventId)
  if (!userId) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('event_room_config').upsert({
    event_id: eventId,
    room_id: roomId,
    reserved: false,
    reservation_note: null,
    reservation_note_public: false,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,room_id' })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

// ─── Bed blocking ─────────────────────────────────────────────────────────────

export async function epBlockBed(
  eventId: string,
  roomId: string,
  bedNumber: number,
  note?: string,
): Promise<{ success: true } | { error: string }> {
  const userId = await epGuard(eventId)
  if (!userId) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('bed_blocks').upsert({
    event_id: eventId,
    room_id: roomId,
    bed_number: bedNumber,
    block_note: note ?? null,
    created_by: userId,
  }, { onConflict: 'event_id,room_id,bed_number' })
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

export async function epUnblockBed(
  eventId: string,
  roomId: string,
  bedNumber: number,
): Promise<{ success: true } | { error: string }> {
  if (!await epGuard(eventId)) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bed_blocks')
    .delete()
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('bed_number', bedNumber)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

// ─── Attendee assignment ──────────────────────────────────────────────────────

export type EpAssignWarning =
  | 'exceeds_capacity'
  | 'user_has_room'
  | 'room_blocked_or_reserved'
  | 'missing_prerequisites'

export async function epAssignAttendee(
  eventId: string,
  roomId: string,
  userEmail: string,
  force?: boolean,
): Promise<
  | { success: true }
  | { warning: EpAssignWarning; message: string }
  | { error: string }
> {
  if (!await epGuard(eventId)) return { error: 'Access denied.' }

  const admin = createAdminClient()

  // Look up user by email
  const { data: targetUser } = await admin
    .from('platform_users')
    .select('id')
    .eq('email', userEmail.toLowerCase().trim())
    .single()
  if (!targetUser) return { error: 'User not found.' }

  // Fetch target attendee record
  const { data: attendee } = await admin
    .from('event_attendees')
    .select('id, ticket_status, room_id, application_status')
    .eq('event_id', eventId)
    .eq('user_id', targetUser.id)
    .single()
  if (!attendee) return { error: 'This user is not enrolled in this event.' }

  if (!force) {
    // Warning 1: user already has a room
    if (attendee.room_id) {
      const { data: existingRoom } = await admin
        .from('rooms').select('name, number').eq('id', attendee.room_id).single()
      const roomLabel = existingRoom ? `${existingRoom.name}${existingRoom.number ? ` (${existingRoom.number})` : ''}` : 'another room'
      return { warning: 'user_has_room', message: `This user is currently in ${roomLabel}. Assigning will move them. Proceed?` }
    }

    // Fetch room details
    const { data: room } = await admin
      .from('rooms')
      .select('bed_spot_count')
      .eq('id', roomId)
      .single()
    if (!room) return { error: 'Room not found.' }

    // Warning 2: room is blocked or reserved
    const { data: cfg } = await admin
      .from('event_room_config')
      .select('blocked, reserved')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .single()
    if (cfg?.blocked || cfg?.reserved) {
      const state = cfg.blocked ? 'blocked' : 'reserved'
      return { warning: 'room_blocked_or_reserved', message: `This room is currently ${state}. Assigning a user will not unblock it. Proceed?` }
    }

    // Warning 3: exceeds capacity
    const { count: occupantCount } = await admin
      .from('event_attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])
    if ((occupantCount ?? 0) >= room.bed_spot_count) {
      return { warning: 'exceeds_capacity', message: `This room is at or above max occupancy (${room.bed_spot_count}). Proceed anyway?` }
    }

    // Warning 4: missing prerequisites (ticket required)
    if (attendee.ticket_status !== 'Complete') {
      return { warning: 'missing_prerequisites', message: 'This user has not completed the required steps (ticket purchase). Proceed anyway?' }
    }
  }

  // Perform assignment
  const { error } = await admin
    .from('event_attendees')
    .update({ room_id: roomId, room_status: 'Selected' })
    .eq('event_id', eventId)
    .eq('user_id', targetUser.id)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}

export async function epRemoveAttendee(
  eventId: string,
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  if (!await epGuard(eventId)) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('event_attendees')
    .update({ room_id: null, room_status: 'Not Selected', is_room_lead: false })
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('room_id', roomId)
  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/venue`)
  return { success: true }
}
