'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VolunteerSignup = {
  id: string
  shift_id: string
  status: string
}

// ── 1. signUpForShift ─────────────────────────────────────────────────────────

export async function signUpForShift(
  eventId: string,
  shiftId: string,
): Promise<{ error?: string; signup?: VolunteerSignup } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.lock_status === 'Locked') {
    return { error: 'Your attendance is locked.' }
  }

  // Event terminal-status guard
  const { data: eventData } = await admin
    .from('platform_events')
    .select('status')
    .eq('id', eventId)
    .single()
  if (eventData?.status && ['Closed', 'Archived', 'Event Locked'].includes(eventData.status)) {
    return { error: 'Volunteer signups are closed for this event.' }
  }

  // Verify shift belongs to this event
  const { data: shift } = await admin
    .from('volunteer_shifts')
    .select('id, date_time, duration_minutes')
    .eq('id', shiftId)
    .eq('event_id', eventId)
    .single()

  if (!shift) return { error: 'Shift not found.' }

  // Overlap check: fetch user's confirmed signups for this event
  const { data: mySignups } = await supabase
    .from('user_volunteer_signups')
    .select('shift_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  if (mySignups && mySignups.length > 0) {
    const existingIds = mySignups.map(s => s.shift_id).filter(id => id !== shiftId)

    if (mySignups.some(s => s.shift_id === shiftId)) {
      return { error: 'You are already signed up for this shift.' }
    }

    if (existingIds.length > 0) {
      const { data: existingShifts } = await admin
        .from('volunteer_shifts')
        .select('id, date_time, duration_minutes')
        .in('id', existingIds)

      if (existingShifts) {
        const newStart = new Date(shift.date_time).getTime()
        const newEnd = newStart + shift.duration_minutes * 60 * 1000

        for (const existing of existingShifts) {
          const existStart = new Date(existing.date_time).getTime()
          const existEnd = existStart + existing.duration_minutes * 60 * 1000
          if (newStart < existEnd && existStart < newEnd) {
            return { error: 'This shift overlaps with one you are already signed up for.' }
          }
        }
      }
    }
  }

  const { data: signup, error: insertError } = await supabase
    .from('user_volunteer_signups')
    .insert({
      event_id: eventId,
      user_id: user.id,
      shift_id: shiftId,
      status: 'confirmed',
    })
    .select('id, shift_id, status')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { error: 'You are already signed up for this shift.' }
    return { error: 'Failed to sign up. Please try again.' }
  }

  // Notification row 17 (scheduled reminder) — handled by external scheduler
  console.log(`[notification-17-queued] Volunteer signup confirmed: userId=${user.id} shiftId=${shiftId} eventId=${eventId}`)

  revalidatePath(`/events/${eventId}/volunteer`)
  revalidatePath(`/events/${eventId}`)

  return { signup: signup as VolunteerSignup }
}

// ── 2. cancelSignup ───────────────────────────────────────────────────────────

export async function cancelSignup(
  signupId: string,
  eventId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'Attendee record not found.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked.' }

  // Event terminal-status guard
  const { data: eventData } = await admin
    .from('platform_events')
    .select('status')
    .eq('id', eventId)
    .single()
  if (eventData?.status && ['Closed', 'Archived', 'Event Locked'].includes(eventData.status)) {
    return { error: 'Volunteer signups are closed for this event.' }
  }

  const { error } = await supabase
    .from('user_volunteer_signups')
    .delete()
    .eq('id', signupId)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  if (error) return { error: 'Failed to cancel signup. Please try again.' }

  revalidatePath(`/events/${eventId}/volunteer`)
  revalidatePath(`/events/${eventId}`)
}
