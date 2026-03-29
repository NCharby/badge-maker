'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createInPlatformNotification } from '@/lib/notifications'

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

  const { error: updateError } = await supabase
    .from('event_attendees')
    .update({ room_id: roomId, room_status: 'Selected' })
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  if (updateError) return { error: 'Failed to claim room. Please try again.' }

  // Notification row 6 — Room Lead confirms room selection
  // TODO: send email to Room Lead: event name, room number, room type, check-in/out date
  void createInPlatformNotification({
    userId: user.id,
    type: 'room_lead_confirmed',
    title: 'Room selected',
    body: 'You have claimed your room. Your selection is now visible in the Roommate Finder.',
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
  // Lookup Room Lead for in-platform notification (admin — cross-user read)
  const { data: roomLead } = await admin
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('is_room_lead', true)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])
    .limit(1)
    .single()

  if (roomLead) {
    void createInPlatformNotification({
      userId: roomLead.user_id,
      type: 'roommate_applied',
      title: 'Roommate application',
      body: 'Someone has applied for a spot in your room.',
      actionUrl: `/events/${eventId}/rooms/${roomId}`,
      actionLabel: 'Manage Room',
      eventId,
    })
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
  // TODO: send email + Telegram to claimed user: Room Lead scene name, room name/number, event name
  void createInPlatformNotification({
    userId: targetUser.id,
    type: 'room_claim_received',
    title: 'Room invitation',
    body: 'A Room Lead has invited you to join their room. Accept or decline in your portal.',
    actionUrl: `/events/${eventId}/rooms`,
    actionLabel: 'Accept or Decline',
    eventId,
  })

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

  if (otherPending && otherPending.length > 0) {
    await admin
      .from('roommate_applications')
      .update({ status: 'superseded', resolved_at: now, resolved_by: user.id })
      .in('id', otherPending.map(a => a.id))

    for (const other of otherPending) {
      // Notification row 9 — room application declined (superseded)
      // TODO: send email + Telegram to applicant: event name
      void createInPlatformNotification({
        userId: other.applicant_user_id,
        type: 'room_application_declined',
        title: 'Room application not accepted',
        body: 'Your room application was not accepted — another applicant was selected for this spot.',
        actionUrl: `/events/${eventId}/rooms`,
        actionLabel: 'Browse Rooms',
        eventId,
      })
    }
  }

  // Notification row 8 — room application accepted
  // TODO: send email + Telegram to accepted roommate: event name, room number, room type
  void createInPlatformNotification({
    userId: application.applicant_user_id,
    type: 'room_application_accepted',
    title: 'Room application accepted',
    body: 'Your room application was accepted. You have been placed in the room.',
    actionUrl: `/events/${eventId}/rooms/${application.room_id}`,
    actionLabel: 'View Room',
    eventId,
  })

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
  // TODO: send email + Telegram to applicant: event name
  void createInPlatformNotification({
    userId: application.applicant_user_id,
    type: 'room_application_declined',
    title: 'Room application declined',
    body: 'Your room application was declined.',
    actionUrl: `/events/${eventId}/rooms`,
    actionLabel: 'Browse Rooms',
    eventId,
  })

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
  // TODO: send email to Room Lead: accepted user's scene name, event name, room number
  const { data: roomLeadRow } = await admin
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .eq('is_room_lead', true)
    .limit(1)
    .single()

  if (roomLeadRow) {
    void createInPlatformNotification({
      userId: roomLeadRow.user_id,
      type: 'room_claim_accepted',
      title: 'Roommate accepted your invitation',
      body: 'Someone accepted your room invitation and has been placed in your room.',
      actionUrl: `/events/${eventId}/rooms/${roomId}`,
      actionLabel: 'Manage Room',
      eventId,
    })
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
  // TODO: send email to Room Lead: declined user's scene name, event name
  const { data: roomLeadDeclineRow } = await admin
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('room_id', application.room_id)
    .eq('is_room_lead', true)
    .limit(1)
    .single()

  if (roomLeadDeclineRow) {
    void createInPlatformNotification({
      userId: roomLeadDeclineRow.user_id,
      type: 'room_claim_declined',
      title: 'Roommate declined your invitation',
      body: 'Someone declined your room invitation.',
      actionUrl: `/events/${eventId}/rooms/${application.room_id}`,
      actionLabel: 'Manage Room',
      eventId,
    })
  }

  revalidatePath(`/events/${eventId}/rooms`)
}
