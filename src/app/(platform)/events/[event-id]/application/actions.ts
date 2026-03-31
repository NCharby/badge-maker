'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification, epWantsInPlatform } from '@/lib/notifications'
import { sendEventChannelMessage } from '@/lib/telegram/send'

export async function saveDraft(
  eventId: string,
  formId: string,
  responses: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch current attendee status
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked — no further changes can be made.' }
  if (attendee.application_status === 'Closed') return { error: 'This application is closed.' }

  const { error: responseError } = await supabase
    .from('application_responses')
    .upsert(
      { event_id: eventId, user_id: user.id, form_id: formId, responses },
      { onConflict: 'event_id,user_id' }
    )
  if (responseError) return { error: responseError.message }

  // Advance from Incomplete → In Progress on first save
  if (attendee.application_status === 'Incomplete') {
    await supabase
      .from('event_attendees')
      .update({ application_status: 'In Progress' })
      .eq('event_id', eventId)
      .eq('user_id', user.id)
  }

  revalidatePath(`/events/${eventId}/application`)
  return { success: true }
}

export async function submitApplication(
  eventId: string,
  formId: string,
  responses: Record<string, unknown>
) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  // Track whether this is a re-submission (attendee already submitted before)
  // Incomplete / In Progress = never submitted; any other status = previously submitted
  const isResubmission = !!attendee && !['Incomplete', 'In Progress'].includes(attendee.application_status)

  if (!attendee) {
    // First submission — create the attendee record. Submitting an application IS the enrollment action.
    const { error: enrollError } = await admin
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: user.id })
    if (enrollError) return { error: 'Failed to enroll. Please try again.' }
  } else {
    if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked.' }
    if (attendee.application_status === 'Closed') return { error: 'This application is closed.' }
  }

  const { error: responseError } = await supabase
    .from('application_responses')
    .upsert(
      {
        event_id: eventId,
        user_id: user.id,
        form_id: formId,
        responses,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id' }
    )
  if (responseError) return { error: responseError.message }

  const { error: statusError } = await supabase
    .from('event_attendees')
    .update({ application_status: 'Needs Review' })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
  if (statusError) return { error: statusError.message }

  // Row 4 (first submit) / Row 5 (re-submit) → notify EP (configurable; default true)
  // TODO: send email / Telegram to EP per their notification_preferences
  const notificationType = isResubmission ? 'application_updated' : 'application_submitted'
  const { data: eventRow } = await admin
    .from('platform_events')
    .select('owner_id, title')
    .eq('id', eventId)
    .single()

  if (eventRow) {
    const [{ data: epProfile }, { data: applicantProfile }] = await Promise.all([
      admin
        .from('platform_users')
        .select('notification_preferences')
        .eq('id', eventRow.owner_id)
        .single(),
      admin
        .from('platform_users')
        .select('preferred_scene_name, email')
        .eq('id', user.id)
        .single(),
    ])

    const attendeeDisplayName = applicantProfile?.preferred_scene_name?.trim()
      || (applicantProfile?.email?.split('@')[0] ?? 'An attendee')
    const eventTitle = eventRow.title ?? 'the event'

    const prefs = epProfile?.notification_preferences as Record<string, { in_platform?: boolean }> | null
    if (epWantsInPlatform(prefs, notificationType)) {
      void createInPlatformNotification({
        userId: eventRow.owner_id,
        type: notificationType,
        title: isResubmission ? 'Application updated' : 'Application submitted',
        body: isResubmission
          ? `${attendeeDisplayName} updated and re-submitted their application for ${eventTitle}.`
          : `${attendeeDisplayName} submitted an application for ${eventTitle}.`,
        actionUrl: `/ep/events/${eventId}/attendees/${user.id}`,
        actionLabel: 'Review Application',
        eventId,
      })
    }

    // First enrollment: notify channel and/or DM the new attendee per EP config
    if (!isResubmission && !attendee) {
      void sendEventChannelMessage(eventId, 'new_attendee_enrolled', {
        event_name: eventTitle,
        scene_name: attendeeDisplayName,
      }, user.id)
    }
  }

  revalidatePath(`/events/${eventId}/application`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function withdrawApplication(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked — withdrawal is not permitted.' }
  if (attendee.application_status === 'Incomplete') return { error: 'Nothing to withdraw.' }

  const { error } = await supabase
    .from('event_attendees')
    .update({ application_status: 'Incomplete' })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/application`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
