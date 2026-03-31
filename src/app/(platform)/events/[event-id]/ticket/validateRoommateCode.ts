'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification } from '@/lib/notifications'
import { sendTelegramDM } from '@/lib/telegram/send'

export type ValidateRoommateCodeResult =
  | { valid: false; reason: 'invalid_code' | 'room_not_selected' | 'room_full' }
  | {
      valid: true
      roomId: string
      roomName: string
      roomNumber: string
      roomLeadName: string
      lodgingType: string | null
      nightlyTotal: number | null
    }

type RateEntry = { date: string; amount: number }

export async function validateRoommateCode(
  eventId: string,
  code: string,
): Promise<ValidateRoommateCodeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { valid: false, reason: 'invalid_code' }

  // All data queries use admin client — RLS blocks regular users from reading
  // other users' event_attendees rows, rooms, event_room_config, bed_blocks, and locks.
  const admin = createAdminClient()

  // 1. Look up Room Lead attendee by code (case-insensitive: code stored uppercase)
  const { data: leadAttendee } = await admin
    .from('event_attendees')
    .select('user_id, room_id, is_room_lead')
    .eq('event_id', eventId)
    .eq('roommate_code', code.toUpperCase().trim())
    .eq('is_room_lead', true)
    .single()

  if (!leadAttendee) return { valid: false, reason: 'invalid_code' }

  // 2. Room Lead must have a room assigned
  if (!leadAttendee.room_id) return { valid: false, reason: 'room_not_selected' }
  const roomId = leadAttendee.room_id

  // 3. Fetch room details and event_room_config in parallel
  const [{ data: room }, { data: roomConfig }] = await Promise.all([
    admin
      .from('rooms')
      .select('id, name, number, lodging_type, bed_spot_count, room_daily_rates')
      .eq('id', roomId)
      .single(),
    admin
      .from('event_room_config')
      .select('blocked, reserved')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .maybeSingle(),
  ])

  if (!room) return { valid: false, reason: 'invalid_code' }

  // Blocked or reserved rooms are treated as invalid (no capacity message per spec)
  if (roomConfig?.blocked || roomConfig?.reserved) return { valid: false, reason: 'invalid_code' }

  // 4. Compute available spots
  const now = new Date().toISOString()

  const [
    { count: bedBlockCount },
    { count: occupantCount },
    { count: activeLockCount },
  ] = await Promise.all([
    admin
      .from('bed_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('room_id', roomId),
    admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .in('room_status', ['Selected', 'Locked In', 'Verified']),
    admin
      .from('locks')
      .select('*', { count: 'exact', head: true })
      .eq('resource_type', 'room')
      .eq('resource_id', roomId)
      .gte('expires_at', now),
  ])

  const availableSpots =
    room.bed_spot_count -
    (bedBlockCount ?? 0) -
    (occupantCount ?? 0) -
    (activeLockCount ?? 0)

  if (availableSpots <= 0) {
    // Notification row 33: Room Lead notified their room is full — dedup within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [{ count: recentCount }, { data: eventRowFull }] = await Promise.all([
      admin
        .from('platform_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', leadAttendee.user_id)
        .eq('notification_type', 'roommate_code_room_full')
        .eq('event_id', eventId)
        .gte('created_at', oneHourAgo),
      admin.from('platform_events').select('title').eq('id', eventId).single(),
    ])

    if ((recentCount ?? 0) === 0) {
      const row33Body = `Someone tried to use your Roommate Code for ${eventRowFull?.title ?? 'the event'} but your room is currently full.`
      void createInPlatformNotification({
        userId: leadAttendee.user_id,
        type: 'roommate_code_room_full',
        title: 'Roommate Code attempt — room full',
        body: row33Body,
        actionUrl: `/events/${eventId}/rooms/${roomId}`,
        actionLabel: 'Manage Room',
        eventId,
      })
      // Row 33: Telegram to Room Lead
      void sendTelegramDM(leadAttendee.user_id, row33Body)
    }
    return { valid: false, reason: 'room_full' }
  }

  // 5. Fetch Room Lead display name
  const { data: leadUser } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', leadAttendee.user_id)
    .single()

  const roomLeadName =
    leadUser?.preferred_scene_name?.trim()
      ? leadUser.preferred_scene_name
      : (leadUser?.email?.split('@')[0] ?? 'Room Lead')

  // 6. Sum nightly total from room_daily_rates JSONB
  const rates = (room.room_daily_rates ?? []) as RateEntry[]
  const nightlyTotal =
    rates.length > 0 ? rates.reduce((sum, r) => sum + Number(r.amount), 0) : null

  return {
    valid: true,
    roomId,
    roomName: room.name,
    roomNumber: room.number ?? '',
    roomLeadName,
    lodgingType: room.lodging_type,
    nightlyTotal,
  }
}
