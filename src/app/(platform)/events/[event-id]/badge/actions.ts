'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBadgeMakerEventForPlatformEvent } from '@/lib/badge-maker-bridge'
import { createInPlatformNotification } from '@/lib/notifications'
import { getModuleOpenState } from '@/lib/modules'
import type { WorkflowStatus } from '@/types/platform'
import { revalidatePath } from 'next/cache'

export async function createPlatformBadge(
  eventId: string,
  data: {
    badgeName: string
    socialMediaHandles: { platform: string; handle: string }[]
    originalImageUrl: string | null
    croppedImageUrl: string | null
    cropData: Record<string, unknown> | null
  }
): Promise<{ success: boolean; badgeId?: string; error?: string }> {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const email = user.email
    if (!email) {
      return { success: false, error: 'User email is required' }
    }

    const admin = createAdminClient()

    // 2. Resolve platform event to badge-maker event and verify module is open
    const { data: platformEvent } = await admin
      .from('platform_events')
      .select('status, module_config, workflow_statuses')
      .eq('id', eventId)
      .single()

    if (!platformEvent) {
      return { success: false, error: 'Event not found' }
    }

    const workflowStatuses = (platformEvent.workflow_statuses ?? []) as WorkflowStatus[]
    const badgeCfg = (platformEvent.module_config as Record<string, { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined> | null)?.badge
    if (!badgeCfg?.enabled) return { success: false, error: 'Badge module is not enabled for this event.' }

    const moduleState = getModuleOpenState(
      { enabled: true, required: badgeCfg.required ?? false, opens_at_status: badgeCfg.opens_at_status ?? null, closes_at_status: badgeCfg.closes_at_status ?? null },
      platformEvent.status,
      workflowStatuses,
    )
    if (moduleState !== 'open') return { success: false, error: 'Badge creation is not currently available.' }

    const bridge = await getBadgeMakerEventForPlatformEvent(eventId)
    if (!bridge) {
      return { success: false, error: 'Badge module is not configured for this event' }
    }

    const { slug, badgeMakerEventId } = bridge

    // 3. Validate inputs
    if (!data.badgeName || data.badgeName.trim().length === 0) {
      return { success: false, error: 'Badge name is required' }
    }
    if (data.badgeName.length > 40) {
      return { success: false, error: 'Badge name must be 40 characters or less' }
    }
    if (!data.originalImageUrl && !data.croppedImageUrl) {
      return { success: false, error: 'Badge photo is required' }
    }
    if (data.socialMediaHandles && data.socialMediaHandles.length > 2) {
      return { success: false, error: 'Maximum 2 social media handles allowed' }
    }

    // 4. Fetch attendee record
    const { data: attendee, error: attendeeError } = await supabase
      .from('event_attendees')
      .select('id, badge_status, badge_maker_waiver_id, badge_maker_badge_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single()

    if (attendeeError || !attendee) {
      return { success: false, error: 'You are not enrolled in this event' }
    }

    if (attendee.badge_status === 'Complete') {
      return { success: false, error: 'Badge has already been created for this event' }
    }

    // Filter out empty/none social media handles
    const socialMediaHandles = (data.socialMediaHandles || []).filter(
      h => h.platform && h.platform !== 'none' && h.handle.trim().length > 0
    )

    // 5. Create a new session for badge (always fresh — don't reuse waiver session)
    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .insert({
        session_data: {
          badge_name: data.badgeName,
          email,
          social_media_handles: socialMediaHandles,
        },
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error('[badge] session creation error:', sessionError?.message)
      return { success: false, error: 'Failed to create badge session' }
    }
    const sessionId = session.id

    // 7. Create badge in badge-maker badges table
    const { data: badge, error: badgeError } = await admin
      .from('badges')
      .insert({
        session_id: sessionId,
        event_id: badgeMakerEventId,
        waiver_id: attendee.badge_maker_waiver_id || null,
        badge_name: data.badgeName,
        email,
        original_image_url: data.originalImageUrl,
        cropped_image_url: data.croppedImageUrl,
        crop_data: data.cropData,
        social_media_handles: socialMediaHandles,
        badge_data: {
          badge_name: data.badgeName,
          email,
          social_media_handles: socialMediaHandles,
          original_image_url: data.originalImageUrl,
          cropped_image_url: data.croppedImageUrl,
          crop_data: data.cropData,
        },
        status: 'published',
      })
      .select('id')
      .single()

    if (badgeError || !badge) {
      console.error('[badge] badge creation error:', badgeError?.message)
      return { success: false, error: 'Failed to create badge' }
    }

    // 8. Telegram invite generation (non-fatal, fire-and-forget)
    try {
      const { createTelegramService } = await import('@/lib/telegram/telegram-service')
      const svc = createTelegramService()
      if (await svc.isAvailable(slug)) {
        await svc.generatePrivateInvite(slug, sessionId)
      }
    } catch (telegramErr) {
      console.error('[badge] telegram invite error:', telegramErr)
    }

    // 9. Update attendee record (atomic guard: only if still Incomplete)
    const { data: updated, error: updateError } = await admin
      .from('event_attendees')
      .update({
        badge_status: 'Complete',
        badge_maker_badge_id: badge.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendee.id)
      .eq('badge_status', 'Incomplete')
      .select('id')

    if (updateError) {
      console.error('[badge] attendee update error:', updateError.message)
    }

    if (!updated || updated.length === 0) {
      // Badge record was created but attendee already marked complete — likely a race.
      // Return success since the badge exists; the duplicate guard at step 4 prevents re-entry on refresh.
      return { success: true, badgeId: badge.id }
    }

    // 10. In-platform notification (fire-and-forget)
    void createInPlatformNotification({
      userId: user.id,
      type: 'badge_completed',
      title: 'Badge Created',
      body: 'Your event badge has been created.',
      eventId,
    })

    // 11. Badge confirmation email (fire-and-forget, non-fatal)
    try {
      const { getBadgeConfirmationData, sendBadgeConfirmationEmailWithTemplate } = await import('@/lib/email')
      const confirmationData = await getBadgeConfirmationData(badge.id, slug)
      if (confirmationData) {
        await sendBadgeConfirmationEmailWithTemplate(confirmationData)
      }
    } catch (emailErr) {
      console.error('[badge] confirmation email error:', emailErr)
      // Non-fatal
    }

    // 12. Revalidate paths
    revalidatePath(`/events/${eventId}`)
    revalidatePath(`/events/${eventId}/badge`)

    return { success: true, badgeId: badge.id }
  } catch (err) {
    console.error('[badge] unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
