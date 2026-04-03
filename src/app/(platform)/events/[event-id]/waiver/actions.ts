'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getWaiverProvider } from '@/lib/waiver'
import { createInPlatformNotification } from '@/lib/notifications'
import { getModuleOpenState } from '@/lib/modules'
import { deriveFirstLastName } from '@/types/platform'
import type { WorkflowStatus } from '@/types/platform'

const MAX_SIGNATURE_SIZE = 500 * 1024 // 500 KB base64

interface SubmitWaiverInput {
  signatureImage: string
}

export async function submitWaiver(
  eventId: string,
  input: SubmitWaiverInput,
): Promise<{ success: true } | { error: string }> {
  // ---- Auth check ----
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // ---- Validate signature size ----
  if (!input.signatureImage) return { error: 'Signature is required.' }
  if (input.signatureImage.length > MAX_SIGNATURE_SIZE) {
    return { error: 'Signature data is too large. Please clear and try again.' }
  }

  const admin = createAdminClient()

  // ---- Fetch user profile (user-scoped — reading own row) ----
  const { data: profile } = await supabase
    .from('platform_users')
    .select('preferred_scene_name, email, date_of_birth, emergency_contact, emergency_phone')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'User profile not found.' }

  // ---- Fetch event and verify module is open ----
  const { data: event } = await admin
    .from('platform_events')
    .select('slug, title, status, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()

  if (!event?.slug) return { error: 'Event not found.' }

  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const waiverCfg = (event.module_config as Record<string, { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined> | null)?.waiver
  if (!waiverCfg?.enabled) return { error: 'Waiver module is not enabled for this event.' }

  const moduleState = getModuleOpenState(
    { enabled: true, required: waiverCfg.required ?? false, opens_at_status: waiverCfg.opens_at_status ?? null, closes_at_status: waiverCfg.closes_at_status ?? null },
    event.status,
    workflowStatuses,
  )
  if (moduleState !== 'open') return { error: 'Waiver signing is not currently available.' }

  // ---- Fetch attendee record to guard against double-submit ----
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('waiver_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) return { error: 'You are not enrolled in this event.' }
  if (attendee.waiver_status === 'Completed') return { error: 'Waiver has already been signed.' }
  if (attendee.lock_status === 'Locked') return { error: 'Your attendance is locked — no further changes can be made.' }

  // ---- Derive first/last name ----
  const { firstName, lastName } = deriveFirstLastName(profile.preferred_scene_name, profile.email)

  // ---- Submit via provider ----
  const provider = getWaiverProvider()
  const result = await provider.submitWaiver({
    firstName,
    lastName,
    email: profile.email,
    dateOfBirth: profile.date_of_birth,
    emergencyContact: profile.emergency_contact ?? '',
    emergencyPhone: profile.emergency_phone ?? '',
    signatureImage: input.signatureImage,
    eventSlug: event.slug,
    userId: user.id,
    eventId,
  })

  if (!result.success) {
    return { error: result.error ?? 'Waiver submission failed.' }
  }

  // ---- Update attendee record (atomic guard: only if still Incomplete + Unlocked) ----
  const { data: updated, error: updateError } = await admin
    .from('event_attendees')
    .update({
      waiver_status: 'Completed',
      badge_maker_waiver_id: result.waiverId ?? null,
    })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('waiver_status', 'Incomplete')
    .neq('lock_status', 'Locked')
    .select('id')

  if (updateError) {
    console.error('[waiver] attendee update error:', updateError.message)
    return { error: 'Waiver was signed but status update failed. Please contact support.' }
  }

  if (!updated || updated.length === 0) {
    return { error: 'Waiver was already submitted or your attendance is locked.' }
  }

  // ---- Fire notification (fire-and-forget) ----
  void createInPlatformNotification({
    userId: user.id,
    type: 'waiver_completed',
    title: 'Waiver signed',
    body: `Your waiver for ${event.title} has been signed and recorded.`,
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Event',
    eventId,
  })

  // ---- Revalidate ----
  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/waiver`)

  return { success: true }
}
