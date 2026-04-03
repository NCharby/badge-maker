'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createInPlatformNotification } from '@/lib/notifications'
import { sendTelegramDM } from '@/lib/telegram/send'

// ── Shared types ────────────────────────────────────────────────────────────

export type RoomFinderCard = {
  room_id: string
  room_number: string
  room_name: string
  lodging_type: string | null
  bed_type: string | null
  has_kitchen: boolean
  location_zone: string | null
  room_group: string | null
  min_occupancy: number
  max_occupancy: number
  effective_max_occupancy: number
  open_spot_count: number
  room_daily_rates: Array<{ date: string; amount: number }> | null
  room_lead_display_name: string // "OPEN" | "Anonymous" | scene name
  occupants: Array<{ display_name: string }>
}

export type PendingInvitation = {
  id: string
  room_id: string
  initiated_by: 'room_lead' | 'roommate'
  created_at: string
}

export type MyApplication = {
  id: string
  room_id: string
  status: string
}

export type IncomingApplication = {
  id: string
  applicant_user_id: string
  initiated_by: 'room_lead' | 'roommate'
  created_at: string
  status: string
  display_name: string
  social_media: unknown | null
}

export type AttendeeRoomState = {
  room_id: string | null
  room_status: string
  is_room_lead: boolean
  lock_status: string
  ticket_status: string
  ticket_type_name: string | null
  roommate_code: string | null
  user_locked: boolean
  room_lead_locked: boolean
}

export type RoomLockRequest = {
  id: string
  room_id: string
  requested_by: string
  status: string
  created_at: string
}

// ── 1. selectRoom ─────────────────────────────────────────────────────────────

export async function selectRoom(
  eventId: string,
  roomId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('is_room_lead, ticket_status, lock_status, room_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee || attendee.ticket_status !== 'Complete') return { error: 'No completed ticket found.' }
  if (!attendee.is_room_lead) return { error: 'Only Room Leads can claim rooms.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your room selection is locked.' }

  // Race condition guard: re-verify room is unclaimed
  const { data: existingLead } = await admin
    .from('event_attendees')
    .select('id')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('is_room_lead', true)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])
    .limit(1)

  if (existingLead && existingLead.length > 0) {
    return { error: 'This room already has a Room Lead.' }
  }

  // Room Leads auto-lock to their room on selection
  const { error: updateError } = await supabase
    .from('event_attendees')
    .update({ room_id: roomId, room_status: 'Selected', user_locked: true })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  if (updateError) return { error: 'Failed to claim room. Please try again.' }

  // Notification row 6 — Room Lead confirms room selection
  // TODO: send email to Room Lead: event name, room number, room type, check-in/out date
  const { data: eventRowSelectRoom } = await admin
    .from('platform_events').select('title').eq('id', eventId).single()
  void createInPlatformNotification({
    userId: user.id,
    type: 'room_lead_confirmed',
    title: 'Room selected',
    body: `You have claimed your room for ${eventRowSelectRoom?.title ?? 'the event'}. Your selection is now visible in the Roommate Finder.`,
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event Hub',
    eventId,
  })

  revalidatePath(`/events/${eventId}/rooms`)
}

// ── 2. applyForRoom ───────────────────────────────────────────────────────────

export async function applyForRoom(
  eventId: string,
  roomId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('is_room_lead, ticket_status, lock_status, room_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee || attendee.ticket_status !== 'Complete') return { error: 'No completed ticket found.' }
  if (attendee.is_room_lead) return { error: 'Room Leads cannot apply for rooms.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your room selection is locked.' }
  if (attendee.room_id) return { error: 'You already have a room selected.' }

  // Duplicate application check
  const { data: existing } = await supabase
    .from('roommate_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('applicant_user_id', user.id)
    .eq('initiated_by', 'roommate')
    .eq('status', 'pending')
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'You already have a pending application for this room.' }
  }

  const { error: insertError } = await supabase
    .from('roommate_applications')
    .insert({
      event_id: eventId,
      room_id: roomId,
      applicant_user_id: user.id,
      initiated_by: 'roommate',
      status: 'pending',
    })

  if (insertError) return { error: 'Failed to submit application. Please try again.' }

  // Notification row 7 — Roommate applies for bed spot
  // TODO: send email + Telegram to Room Lead: applicant scene name, event name, room/spot
  // Lookup Room Lead and fetch event title + applicant display name in parallel
  const [{ data: roomLead }, { data: eventRowApply }, { data: applicantProfile }] = await Promise.all([
    admin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .eq('is_room_lead', true)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])
      .limit(1)
      .single(),
    admin.from('platform_events').select('title').eq('id', eventId).single(),
    admin.from('platform_users').select('preferred_scene_name, email').eq('id', user.id).single(),
  ])

  if (roomLead) {
    const applicantName = applicantProfile?.preferred_scene_name?.trim()
      || (applicantProfile?.email?.split('@')[0] ?? 'A user')
    const applyBody = `${applicantName} has applied for a spot in your room for ${eventRowApply?.title ?? 'the event'}.`
    void createInPlatformNotification({
      userId: roomLead.user_id,
      type: 'roommate_applied',
      title: 'Roommate application',
      body: applyBody,
      actionUrl: `/events/${eventId}/rooms/${roomId}`,
      actionLabel: 'Manage Room',
      eventId,
    })
    // Row 7: Telegram to Room Lead
    void sendTelegramDM(roomLead.user_id, applyBody)
  }

  revalidatePath(`/events/${eventId}/rooms`)
}

// ── 3. withdrawApplication ────────────────────────────────────────────────────

export async function withdrawApplication(
  applicationId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('roommate_applications')
    .update({ status: 'cancelled' })
    .eq('id', applicationId)
    .eq('applicant_user_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: 'Failed to withdraw application.' }

  revalidatePath(`/events/${eventId}/rooms`)
}

// ── 4. claimRoommateByEmail ───────────────────────────────────────────────────

export async function claimRoommateByEmail(
  eventId: string,
  roomId: string,
  email: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify caller is Room Lead for this exact room
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('is_room_lead, room_id, lock_status, ticket_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee?.is_room_lead || attendee.room_id !== roomId) {
    return { error: 'You must be the Room Lead for this room.' }
  }
  if (attendee.lock_status === 'Locked') return { error: 'Your room selection is locked.' }

  // Verify room is not blocked or reserved
  const { data: roomConfig } = await admin
    .from('event_room_config')
    .select('blocked, reserved')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .maybeSingle()

  if (roomConfig?.blocked || roomConfig?.reserved) {
    return { error: 'Room is not available for selection.' }
  }

  // Look up target user
  const { data: targetUser } = await admin
    .from('platform_users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!targetUser) return { error: 'No account found with that email address.' }
  if (targetUser.id === user.id) return { error: 'You cannot invite yourself.' }

  // Check target eligibility
  const { data: targetAttendee } = await admin
    .from('event_attendees')
    .select('ticket_status, room_id')
    .eq('event_id', eventId)
    .eq('user_id', targetUser.id)
    .single()

  if (!targetAttendee || targetAttendee.ticket_status !== 'Complete') {
    return { error: 'This user has not completed the required steps to be eligible.' }
  }
  if (targetAttendee.room_id) {
    return { error: 'This user already has a room selected.' }
  }

  // Duplicate claim check
  const { data: existingClaim } = await admin
    .from('roommate_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('applicant_user_id', targetUser.id)
    .eq('initiated_by', 'room_lead')
    .eq('status', 'pending')
    .limit(1)

  if (existingClaim && existingClaim.length > 0) {
    return { error: 'You have already sent an invitation to this user.' }
  }

  const { error: insertError } = await admin
    .from('roommate_applications')
    .insert({
      event_id: eventId,
      room_id: roomId,
      applicant_user_id: targetUser.id,
      initiated_by: 'room_lead',
      status: 'pending',
    })

  if (insertError) return { error: 'Failed to send invitation. Please try again.' }

  // Notification row 29 — Room Lead claims user by email
  const [{ data: eventRowClaim }, { data: roomLeadProfile }, { data: targetTg }] = await Promise.all([
    admin.from('platform_events').select('title').eq('id', eventId).single(),
    admin.from('platform_users').select('preferred_scene_name, email').eq('id', user.id).single(),
    admin.from('platform_users').select('telegram_handle, telegram_verified, telegram_notifications_enabled').eq('id', targetUser.id).single(),
  ])
  const roomLeadName = roomLeadProfile?.preferred_scene_name?.trim()
    || (roomLeadProfile?.email?.split('@')[0] ?? 'Your Room Lead')
  const row29Body = `${roomLeadName} has invited you to join their room for ${eventRowClaim?.title ?? 'the event'}. Accept or decline in your portal.`
  void createInPlatformNotification({
    userId: targetUser.id,
    type: 'room_claim_received',
    title: 'Room invitation',
    body: row29Body,
    actionUrl: `/events/${eventId}/rooms`,
    actionLabel: 'Accept or Decline',
    eventId,
  })
  // Row 29: Telegram to claimed user
  void sendTelegramDM(targetUser.id, row29Body)

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}/rooms/${roomId}`)
}

// ── 5. acceptApplication ──────────────────────────────────────────────────────

export async function acceptApplication(
  applicationId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: callerAttendee } = await supabase
    .from('event_attendees')
    .select('is_room_lead, room_id, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!callerAttendee?.is_room_lead) return { error: 'Only the Room Lead can accept applications.' }
  if (callerAttendee.lock_status === 'Locked') return { error: 'Room is locked.' }

  const { data: application } = await admin
    .from('roommate_applications')
    .select('applicant_user_id, room_id, status')
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .single()

  if (!application) return { error: 'Application not found or already resolved.' }
  if (application.room_id !== callerAttendee.room_id) {
    return { error: 'This application is not for your room.' }
  }

  // Acquire soft lock on the room to prevent TOCTOU race during capacity check + placement
  const { data: existingLock } = await admin
    .from('locks')
    .select('id')
    .eq('resource_type', 'room')
    .eq('resource_id', application.room_id)
    .gte('expires_at', new Date().toISOString())
    .limit(1)

  if (existingLock && existingLock.length > 0) {
    return { error: 'Room is temporarily locked. Please try again in a moment.' }
  }

  const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { data: lock, error: lockError } = await admin
    .from('locks')
    .insert({ resource_type: 'room', resource_id: application.room_id, locked_by: user.id, expires_at: lockExpiresAt })
    .select('id')
    .single()

  if (lockError || !lock) return { error: 'Could not acquire room lock. Please try again.' }

  try {
    // Capacity check (inside lock)
    const { count: occupantCount } = await admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('room_id', application.room_id)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])

    const { data: roomData } = await admin
      .from('rooms')
      .select('bed_spot_count')
      .eq('id', application.room_id)
      .single()

    if (roomData && occupantCount !== null && occupantCount >= roomData.bed_spot_count) {
      return { error: 'Room is at full capacity.' }
    }

    // Place the roommate
    const { error: updateAttendeeError } = await admin
      .from('event_attendees')
      .update({ room_id: application.room_id, room_status: 'Selected' })
      .eq('event_id', eventId)
      .eq('user_id', application.applicant_user_id)

    if (updateAttendeeError) return { error: 'Failed to place roommate. Please try again.' }
  } finally {
    await admin.from('locks').delete().eq('id', lock.id)
  }

  const now = new Date().toISOString()

  await admin
    .from('roommate_applications')
    .update({ status: 'accepted', resolved_at: now, resolved_by: user.id })
    .eq('id', applicationId)

  // Supersede other pending applications for this room (spec §6.3 conflict resolution)
  const { data: otherPending } = await admin
    .from('roommate_applications')
    .select('id, applicant_user_id')
    .eq('event_id', eventId)
    .eq('room_id', application.room_id)
    .eq('status', 'pending')
    .neq('id', applicationId)

  const { data: eventRowAccept } = await admin
    .from('platform_events').select('title').eq('id', eventId).single()
  const acceptEventTitle = eventRowAccept?.title ?? 'the event'

  if (otherPending && otherPending.length > 0) {
    await admin
      .from('roommate_applications')
      .update({ status: 'superseded', resolved_at: now, resolved_by: user.id })
      .in('id', otherPending.map(a => a.id))

    // Fetch all superseded users' telegram info in one query
    const { data: supersededTgProfiles } = await admin
      .from('platform_users')
      .select('id, telegram_handle, telegram_verified, telegram_notifications_enabled')
      .in('id', otherPending.map(a => a.applicant_user_id))

    for (const other of otherPending) {
      // Notification row 9 — room application declined (superseded)
      const row9Body = `Your room application for ${acceptEventTitle} was not accepted — another applicant was selected for this spot.`
      void createInPlatformNotification({
        userId: other.applicant_user_id,
        type: 'room_application_declined',
        title: 'Room application not accepted',
        body: row9Body,
        actionUrl: `/events/${eventId}/rooms`,
        actionLabel: 'Browse Rooms',
        eventId,
      })
      void sendTelegramDM(other.applicant_user_id, row9Body)
    }
  }

  // Notification row 8 — room application accepted
  const row8Body = `Your room application for ${acceptEventTitle} was accepted. You have been placed in the room.`
  void createInPlatformNotification({
    userId: application.applicant_user_id,
    type: 'room_application_accepted',
    title: 'Room application accepted',
    body: row8Body,
    actionUrl: `/events/${eventId}/rooms/${application.room_id}`,
    actionLabel: 'View Room',
    eventId,
  })
  // Row 8: Telegram to accepted roommate
  void sendTelegramDM(application.applicant_user_id, row8Body)

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}/rooms/${application.room_id}`)
}

// ── 6. declineApplication ─────────────────────────────────────────────────────

export async function declineApplication(
  applicationId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: callerAttendee } = await supabase
    .from('event_attendees')
    .select('is_room_lead, room_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!callerAttendee?.is_room_lead) return { error: 'Only the Room Lead can decline applications.' }

  const { data: application } = await admin
    .from('roommate_applications')
    .select('applicant_user_id, room_id')
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .single()

  if (!application) return { error: 'Application not found or already resolved.' }
  if (application.room_id !== callerAttendee.room_id) {
    return { error: 'This application is not for your room.' }
  }

  const now = new Date().toISOString()
  await admin
    .from('roommate_applications')
    .update({ status: 'declined', resolved_at: now, resolved_by: user.id })
    .eq('id', applicationId)

  // Notification row 9 — room application declined
  const { data: eventRowDecline } = await admin
    .from('platform_events').select('title').eq('id', eventId).single()
  const row9DirectBody = `Your room application for ${eventRowDecline?.title ?? 'the event'} was declined.`
  void createInPlatformNotification({
    userId: application.applicant_user_id,
    type: 'room_application_declined',
    title: 'Room application declined',
    body: row9DirectBody,
    actionUrl: `/events/${eventId}/rooms`,
    actionLabel: 'Browse Rooms',
    eventId,
  })
  // Row 9 direct: Telegram to declined applicant
  void sendTelegramDM(application.applicant_user_id, row9DirectBody)

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}/rooms/${application.room_id}`)
}

// ── 7. acceptInvitation ───────────────────────────────────────────────────────

export async function acceptInvitation(
  applicationId: string,
  eventId: string,
  roomId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify the invitation belongs to this user
  const { data: application } = await supabase
    .from('roommate_applications')
    .select('id, room_id, status')
    .eq('id', applicationId)
    .eq('applicant_user_id', user.id)
    .eq('initiated_by', 'room_lead')
    .eq('status', 'pending')
    .single()

  if (!application) return { error: 'Invitation not found or already resolved.' }

  // Acquire soft lock on the room to prevent TOCTOU race during capacity check + placement
  const { data: existingLock } = await admin
    .from('locks')
    .select('id')
    .eq('resource_type', 'room')
    .eq('resource_id', roomId)
    .gte('expires_at', new Date().toISOString())
    .limit(1)

  if (existingLock && existingLock.length > 0) {
    return { error: 'Room is temporarily locked. Please try again in a moment.' }
  }

  const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { data: lock, error: lockError } = await admin
    .from('locks')
    .insert({ resource_type: 'room', resource_id: roomId, locked_by: user.id, expires_at: lockExpiresAt })
    .select('id')
    .single()

  if (lockError || !lock) return { error: 'Could not acquire room lock. Please try again.' }

  try {
    // Capacity check (inside lock)
    const { count: occupantCount } = await admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])

    const { data: roomData } = await admin
      .from('rooms')
      .select('bed_spot_count')
      .eq('id', roomId)
      .single()

    if (roomData && occupantCount !== null && occupantCount >= roomData.bed_spot_count) {
      return { error: 'This room is now full.' }
    }

    // Update own attendee record
    const { error: attendeeError } = await supabase
      .from('event_attendees')
      .update({ room_id: roomId, room_status: 'Selected' })
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (attendeeError) return { error: 'Failed to accept invitation. Please try again.' }
  } finally {
    await admin.from('locks').delete().eq('id', lock.id)
  }

  const now = new Date().toISOString()

  await supabase
    .from('roommate_applications')
    .update({ status: 'accepted', resolved_at: now, resolved_by: user.id })
    .eq('id', applicationId)

  // Cancel other pending outgoing applications by this user (they now have a room)
  await admin
    .from('roommate_applications')
    .update({ status: 'superseded', resolved_at: now, resolved_by: user.id })
    .eq('event_id', eventId)
    .eq('applicant_user_id', user.id)
    .eq('status', 'pending')
    .neq('id', applicationId)

  // Notification row 30 — claimed user accepts Room Lead's claim
  const [{ data: roomLeadRow }, { data: eventRowAcceptInv }, { data: acceptorProfile }] = await Promise.all([
    admin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .eq('is_room_lead', true)
      .limit(1)
      .single(),
    admin.from('platform_events').select('title').eq('id', eventId).single(),
    admin.from('platform_users').select('preferred_scene_name, email').eq('id', user.id).single(),
  ])

  if (roomLeadRow) {
    const acceptedUserName = acceptorProfile?.preferred_scene_name?.trim()
      || (acceptorProfile?.email?.split('@')[0] ?? 'A user')
    const row30Body = `${acceptedUserName} accepted your room invitation for ${eventRowAcceptInv?.title ?? 'the event'} and has been placed in your room.`
    void createInPlatformNotification({
      userId: roomLeadRow.user_id,
      type: 'room_claim_accepted',
      title: 'Roommate accepted your invitation',
      body: row30Body,
      actionUrl: `/events/${eventId}/rooms/${roomId}`,
      actionLabel: 'Manage Room',
      eventId,
    })
    // Row 30: Telegram to Room Lead
    void sendTelegramDM(roomLeadRow.user_id, row30Body)
  }

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}/rooms/${roomId}`)
}

// ── 8. declineInvitation ──────────────────────────────────────────────────────

export async function declineInvitation(
  applicationId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: application } = await supabase
    .from('roommate_applications')
    .select('id, room_id')
    .eq('id', applicationId)
    .eq('applicant_user_id', user.id)
    .eq('initiated_by', 'room_lead')
    .eq('status', 'pending')
    .single()

  if (!application) return { error: 'Invitation not found or already resolved.' }

  await supabase
    .from('roommate_applications')
    .update({ status: 'declined', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', applicationId)

  // Notification row 31 — claimed user declines Room Lead's claim
  const [{ data: roomLeadDeclineRow }, { data: eventRowDeclineInv }, { data: declinerProfile }] = await Promise.all([
    admin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('room_id', application.room_id)
      .eq('is_room_lead', true)
      .limit(1)
      .single(),
    admin.from('platform_events').select('title').eq('id', eventId).single(),
    admin.from('platform_users').select('preferred_scene_name, email').eq('id', user.id).single(),
  ])

  if (roomLeadDeclineRow) {
    const declinedUserName = declinerProfile?.preferred_scene_name?.trim()
      || (declinerProfile?.email?.split('@')[0] ?? 'A user')
    const row31Body = `${declinedUserName} declined your room invitation for ${eventRowDeclineInv?.title ?? 'the event'}.`
    void createInPlatformNotification({
      userId: roomLeadDeclineRow.user_id,
      type: 'room_claim_declined',
      title: 'Roommate declined your invitation',
      body: row31Body,
      actionUrl: `/events/${eventId}/rooms/${application.room_id}`,
      actionLabel: 'Manage Room',
      eventId,
    })
    // Row 31: Telegram to Room Lead
    void sendTelegramDM(roomLeadDeclineRow.user_id, row31Body)
  }

  revalidatePath(`/events/${eventId}/rooms`)
}

// ── useRoommateCode (post-checkout, from the rooms page) ─────────────────────
// Allows an attendee with a completed ticket but no room to enter a Room Lead's
// Roommate Code from the rooms page (after checkout has already completed).

export async function useRoommateCode(
  eventId: string,
  code: string,
): Promise<
  | { success: true; room: { id: string; name: string; number: string | null; lodging_type: string | null } }
  | { error: string; reason?: 'room_not_selected' | 'room_full' | 'invalid_code' }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', reason: 'invalid_code' }

  const admin = createAdminClient()
  const upperCode = code.toUpperCase().trim()

  // Verify caller has a completed ticket and no room yet
  const { data: myAttendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, room_id, is_room_lead')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!myAttendee) return { error: 'You are not enrolled in this event.', reason: 'invalid_code' }
  if (myAttendee.ticket_status !== 'Complete') return { error: 'You need a completed ticket to use a Roommate Code.', reason: 'invalid_code' }
  if (myAttendee.room_id) return { error: 'You already have a room assigned.', reason: 'invalid_code' }
  if (myAttendee.is_room_lead) return { error: 'Roommate Codes are for non-Room-Lead attendees.', reason: 'invalid_code' }

  // Look up Room Lead attendee by code
  const { data: leadAttendee } = await admin
    .from('event_attendees')
    .select('user_id, room_id, is_room_lead')
    .eq('event_id', eventId)
    .eq('roommate_code', upperCode)
    .eq('is_room_lead', true)
    .maybeSingle()

  if (!leadAttendee) return { error: 'This code is not valid.', reason: 'invalid_code' }

  if (!leadAttendee.room_id) {
    return {
      error: 'Your Room Lead has not selected a room yet. Try again after they select one, or contact your Room Lead directly.',
      reason: 'room_not_selected',
    }
  }

  const roomId = leadAttendee.room_id as string

  // Check room is not blocked or reserved
  const { data: roomConfig } = await admin
    .from('event_room_config')
    .select('blocked, reserved')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .maybeSingle()

  if (roomConfig?.blocked || roomConfig?.reserved) {
    return { error: 'This code is not valid.', reason: 'invalid_code' }
  }

  // Capacity check
  const now = new Date().toISOString()

  const { data: room } = await admin
    .from('rooms')
    .select('id, name, number, lodging_type, bed_spot_count')
    .eq('id', roomId)
    .single()

  if (!room) return { error: 'Room not found.', reason: 'invalid_code' }

  const { count: bedBlocks } = await admin.from('bed_blocks')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId).eq('room_id', roomId)

  const { count: occupants } = await admin.from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId).eq('room_id', roomId)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])

  const { count: roomLocks } = await admin.from('locks')
    .select('*', { count: 'exact', head: true })
    .eq('resource_type', 'room').eq('resource_id', roomId).gte('expires_at', now)

  const available =
    (room.bed_spot_count ?? 0) - (bedBlocks ?? 0) - (occupants ?? 0) - (roomLocks ?? 0)

  if (available <= 0) {
    const { data: eventRow33 } = await admin.from('platform_events').select('title').eq('id', eventId).single()
    const eventTitle33 = eventRow33?.title ?? 'the event'

    void createInPlatformNotification({
      userId: leadAttendee.user_id as string,
      type: 'roommate_code_room_full',
      title: 'Roommate Code: room is full',
      body: `Someone tried to use your Roommate Code for ${eventTitle33} but your room is full (${room.name}${room.number ? ` · Room ${room.number}` : ''}).`,
      actionUrl: `/events/${eventId}/rooms/${roomId}`,
      actionLabel: 'Manage Room',
      eventId,
    })
    void sendTelegramDM(leadAttendee.user_id as string, `Your Roommate Code was used but your room is full for ${eventTitle33}.`)

    return { error: 'This room is currently full.', reason: 'room_full' }
  }

  // Acquire room soft lock (15 min)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { error: lockErr } = await supabase.from('locks').insert({
    resource_type: 'room', resource_id: roomId, locked_by: user.id, expires_at: expiresAt,
  })
  if (lockErr) return { error: 'Failed to reserve spot. Please try again.', reason: 'invalid_code' }

  // Update attendee: set room, placed_via_code
  const { error: updateErr } = await supabase
    .from('event_attendees')
    .update({ room_id: roomId, room_status: 'Selected', placed_via_code: true })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  // Release lock
  await supabase.from('locks').delete().eq('locked_by', user.id).eq('resource_type', 'room').eq('resource_id', roomId)

  if (updateErr) return { error: 'Failed to assign room. Please try again.', reason: 'invalid_code' }

  // Notify Room Lead (row 32)
  const { data: myProfile } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', user.id)
    .single()
  const myName = myProfile?.preferred_scene_name?.trim() || myProfile?.email?.split('@')[0] || 'A user'

  const { data: eventRow32 } = await admin.from('platform_events').select('title').eq('id', eventId).single()
  const eventTitle32 = eventRow32?.title ?? 'the event'

  const row32Body = `${myName} used your Roommate Code and has been placed in your room for ${eventTitle32}.`
  void createInPlatformNotification({
    userId: leadAttendee.user_id as string,
    type: 'roommate_code_used',
    title: 'Roommate joined your room',
    body: row32Body,
    actionUrl: `/events/${eventId}/rooms/${roomId}`,
    actionLabel: 'Manage Room',
    eventId,
  })
  void sendTelegramDM(leadAttendee.user_id as string, row32Body)

  revalidatePath(`/events/${eventId}/rooms`)

  return {
    success: true,
    room: { id: room.id, name: room.name, number: room.number, lodging_type: room.lodging_type },
  }
}

// ── releaseRoom ───────────────────────────────────────────────────────────────

export async function releaseRoom(
  eventId: string,
  roomId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('room_id, lock_status, ticket_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee || attendee.ticket_status !== 'Complete') return { error: 'No completed ticket found.' }
  if (attendee.room_id !== roomId) return { error: 'This is not your current room.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your room selection is locked and cannot be changed.' }

  const { error: updateError } = await supabase
    .from('event_attendees')
    .update({ room_id: null, room_status: 'Not Selected', is_room_lead: false, user_locked: false, room_lead_locked: false })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  if (updateError) return { error: 'Failed to release room. Please try again.' }

  // Cancel any pending lock requests for this user in this room
  await admin
    .from('room_lock_requests')
    .update({ status: 'declined', resolved_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('target_user_id', user.id)
    .eq('status', 'pending')

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}/rooms/${roomId}`)
}

// ── User self-lock ──────────────────────────────────────────────────────────

export async function userSelfLock(
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('room_id, room_status, lock_status, user_locked')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'No attendee record found.' }
  if (!attendee.room_id) return { error: 'You have no room selected.' }
  if (attendee.room_status !== 'Selected') return { error: 'Room cannot be locked in its current status.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is already locked by the Event Promoter.' }
  if (attendee.user_locked) return { error: 'You are already locked to your room.' }

  await supabase
    .from('event_attendees')
    .update({ user_locked: true })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}`)
}

// ── Room Lead send lock request ─────────────────────────────────────────────

export async function roomLeadSendLockRequest(
  eventId: string,
): Promise<{ error?: string; sent?: number } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('room_id, is_room_lead, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee?.is_room_lead) return { error: 'Only Room Leads can send lock requests.' }
  if (!attendee.room_id) return { error: 'You have no room selected.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is already locked.' }

  // Check EP config
  const { data: event } = await admin
    .from('platform_events')
    .select('title, module_config')
    .eq('id', eventId)
    .single()
  const moduleConfig = (event?.module_config ?? {}) as Record<string, { room_lead_can_lock?: boolean; room_lead_can_lock_with_open_spots?: boolean } | undefined>
  const roomCfg = moduleConfig.room_selection ?? moduleConfig.venue
  if (!roomCfg?.room_lead_can_lock) return { error: 'Room Lead locking is not enabled for this event.' }

  // Check open spots if required
  if (!roomCfg.room_lead_can_lock_with_open_spots) {
    const { data: room } = await admin
      .from('rooms')
      .select('bed_spot_count')
      .eq('id', attendee.room_id)
      .single()
    const { count: bedBlocks } = await admin.from('bed_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('room_id', attendee.room_id)
    const { count: occupants } = await admin.from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('room_id', attendee.room_id)
      .in('room_status', ['Selected', 'Locked In', 'Verified'])
    const effectiveMax = (room?.bed_spot_count ?? 0) - (bedBlocks ?? 0)
    if ((occupants ?? 0) < effectiveMax) {
      return { error: 'Cannot lock the room while there are open bed spots.' }
    }
  }

  // Find occupants who are not yet room_lead_locked
  const { data: unlocked } = await admin
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('room_id', attendee.room_id)
    .eq('room_lead_locked', false)
    .neq('user_id', user.id)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])

  if (!unlocked || unlocked.length === 0) return { error: 'All occupants are already locked.' }

  // Mark RL as user_locked (they already are from selectRoom, but ensure it)
  // room_lead_locked is NOT set here — it is set when all occupants accept
  await supabase
    .from('event_attendees')
    .update({ user_locked: true })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  let sentCount = 0
  for (const occ of unlocked) {
    // Check for existing pending request
    const { data: existing } = await admin
      .from('room_lock_requests')
      .select('id')
      .eq('event_id', eventId)
      .eq('room_id', attendee.room_id)
      .eq('target_user_id', occ.user_id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) continue

    await admin.from('room_lock_requests').insert({
      event_id: eventId,
      room_id: attendee.room_id,
      requested_by: user.id,
      target_user_id: occ.user_id,
    })

    void createInPlatformNotification({
      userId: occ.user_id,
      type: 'room_lock_request',
      title: 'Room Lock Request',
      body: `Your Room Lead has requested that you lock in to your room for ${event?.title ?? 'the event'}. Accept to confirm or decline to leave the room.`,
      actionUrl: `/events/${eventId}/rooms`,
      actionLabel: 'Review Request',
      eventId,
    })
    sentCount++
  }

  revalidatePath(`/events/${eventId}/rooms`)
  return { sent: sentCount }
}

// ── Accept lock request ─────────────────────────────────────────────────────

export async function acceptLockRequest(
  requestId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: req } = await supabase
    .from('room_lock_requests')
    .select('id, room_id, requested_by, target_user_id, status')
    .eq('id', requestId)
    .single()

  if (!req) return { error: 'Lock request not found.' }
  if (req.target_user_id !== user.id) return { error: 'This request is not for you.' }
  if (req.status !== 'pending') return { error: 'This request has already been resolved.' }

  // Update request
  await supabase
    .from('room_lock_requests')
    .update({ status: 'accepted', resolved_at: new Date().toISOString() })
    .eq('id', requestId)

  // Lock the user
  await supabase
    .from('event_attendees')
    .update({ user_locked: true, room_lead_locked: true })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  // Notify Room Lead
  const { data: event } = await admin
    .from('platform_events')
    .select('title')
    .eq('id', eventId)
    .single()
  const { data: profile } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', user.id)
    .single()
  const displayName = profile?.preferred_scene_name?.trim() || profile?.email?.split('@')[0] || 'A roommate'

  void createInPlatformNotification({
    userId: req.requested_by,
    type: 'room_lock_request_accepted',
    title: 'Lock Request Accepted',
    body: `${displayName} has accepted your lock request for ${event?.title ?? 'the event'}.`,
    actionUrl: `/events/${eventId}/rooms/${req.room_id}`,
    actionLabel: 'View Room',
    eventId,
  })

  // Check if all non-RL occupants in this room are now room_lead_locked.
  // If so, also lock the Room Lead to complete the room lock.
  const { data: remaining } = await admin
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('room_id', req.room_id)
    .eq('room_lead_locked', false)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])

  if (!remaining || remaining.length === 0) {
    // All occupants (including RL) are locked — nothing to do
  } else if (remaining.length === 1 && remaining[0].user_id === req.requested_by) {
    // Only the RL remains unlocked — lock them now
    await admin
      .from('event_attendees')
      .update({ room_lead_locked: true })
      .eq('event_id', eventId)
      .eq('user_id', req.requested_by)
  }

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}`)
}

// ── Decline lock request ────────────────────────────────────────────────────

export async function declineLockRequest(
  requestId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: req } = await supabase
    .from('room_lock_requests')
    .select('id, room_id, requested_by, target_user_id, status')
    .eq('id', requestId)
    .single()

  if (!req) return { error: 'Lock request not found.' }
  if (req.target_user_id !== user.id) return { error: 'This request is not for you.' }
  if (req.status !== 'pending') return { error: 'This request has already been resolved.' }

  // Update request
  await supabase
    .from('room_lock_requests')
    .update({ status: 'declined', resolved_at: new Date().toISOString() })
    .eq('id', requestId)

  // Remove user from room
  await supabase
    .from('event_attendees')
    .update({ room_id: null, room_status: 'Not Selected', user_locked: false, room_lead_locked: false })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  // Notify Room Lead
  const { data: event } = await admin
    .from('platform_events')
    .select('title')
    .eq('id', eventId)
    .single()
  const { data: profile } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email')
    .eq('id', user.id)
    .single()
  const displayName = profile?.preferred_scene_name?.trim() || profile?.email?.split('@')[0] || 'A roommate'

  void createInPlatformNotification({
    userId: req.requested_by,
    type: 'room_lock_request_declined',
    title: 'Lock Request Declined',
    body: `${displayName} has declined your lock request and left the room for ${event?.title ?? 'the event'}.`,
    actionUrl: `/events/${eventId}/rooms/${req.room_id}`,
    actionLabel: 'View Room',
    eventId,
  })

  revalidatePath(`/events/${eventId}/rooms`)
  revalidatePath(`/events/${eventId}`)
}
