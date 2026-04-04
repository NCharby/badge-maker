import { createAdminClient } from '@/lib/supabase/server'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  actionLabel?: string
  eventId?: string
}

// Notification type constants — each maps to a row in CLAUDE.md §6.12
export type NotificationType =
  | 'roommate_applied'          // row 7  — roommate applies for bed spot
  | 'room_application_accepted' // row 8  — room application accepted
  | 'room_application_declined' // row 9  — room application declined
  | 'room_lead_confirmed'       // row 6  — room lead confirms room selection
  | 'attendee_locked'           // row 14 — user locked by EP
  | 'ticket_purchased'          // row 15 — ticket purchase complete
  | 'refund_processed'          // row 16 — refund issued
  | 'room_claim_received'       // row 29 — room lead claimed this user
  | 'room_claim_accepted'       // row 30 — claimed user accepted
  | 'room_claim_declined'       // row 31 — claimed user declined
  | 'roommate_code_used'        // row 32 — roommate code used, placed in room
  | 'roommate_code_room_full'   // row 33 — roommate code used but room full
  | 'application_submitted'     // row 4  — EP: attendee submitted application
  | 'application_updated'       // row 5  — EP: attendee updated application
  | 'ready_to_lock'             // row 10 — EP: attendee signalled ready to lock
  | 'area_lead_assigned'        // row 27 — area lead label assigned
  | 'area_lead_removed'         // row 28 — area lead label removed
  | 'application_approved'      // gap    — attendee: EP approved their application
  | 'application_declined'      // gap    — attendee: EP declined their application
  | 'lock_check_reminder'       // EP-initiated — attendee has incomplete required modules
  | 'waiver_completed'          // attendee signed their event waiver
  | 'badge_completed'           // attendee created their event badge
  | 'room_lock_request'         // Room Lead sent lock request to occupant
  | 'room_lock_request_accepted' // Occupant accepted lock request
  | 'room_lock_request_declined' // Occupant declined lock request and left room
  | 'standard_refund_processed'   // EP: attendee self-service refund was processed
  | 'hardship_request_submitted'  // EP: attendee submitted hardship cancellation request
  | 'hardship_request_approved'   // Attendee: EP approved hardship request
  | 'hardship_request_denied'     // Attendee: EP denied hardship request

/**
 * Write an in-platform notification record for the given user.
 *
 * Uses the service role (admin client) so it can write on behalf of any user.
 * Errors are caught and logged — this must never throw or block the calling
 * Server Action.
 */
export async function createInPlatformNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('platform_notifications').insert({
      user_id: input.userId,
      notification_type: input.type,
      title: input.title,
      body: input.body,
      action_url: input.actionUrl ?? null,
      action_label: input.actionLabel ?? null,
      event_id: input.eventId ?? null,
    })
    if (error) {
      console.error('[notifications] insert error:', error.message)
    }
  } catch (err) {
    console.error('[notifications] unexpected error:', err)
  }
}

/**
 * Check whether the in-platform channel is enabled for an EP notification type.
 *
 * EPs configure per-type preferences in platform_users.notification_preferences.
 * If the key is absent or null (not yet configured), defaults to true.
 */
export function epWantsInPlatform(
  preferences: Record<string, { in_platform?: boolean }> | null | undefined,
  type: string,
): boolean {
  if (!preferences) return true
  const pref = preferences[type]
  if (!pref || pref.in_platform === undefined || pref.in_platform === null) return true
  return pref.in_platform
}

/**
 * Check whether the Telegram channel is enabled for an EP notification type.
 *
 * EP Telegram notifications default to OFF (must be explicitly enabled per type).
 */
export function epWantsTelegram(
  preferences: Record<string, { telegram?: boolean }> | null | undefined,
  type: string,
): boolean {
  if (!preferences) return false
  return preferences[type]?.telegram === true
}
