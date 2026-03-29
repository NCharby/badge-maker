'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createInPlatformNotification, epWantsInPlatform } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

export async function signalReadyToLock(eventId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('event_attendees')
    .update({ lock_status: 'Ready to Lock' })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('lock_status', 'Unlocked')

  if (error) return { error: error.message }
  revalidatePath(`/events/${eventId}`)

  // Row 10: user signals Ready to Lock → notify EP (configurable; default true)
  // TODO: send email / Telegram to EP per their notification_preferences
  const { data: eventRow } = await admin
    .from('platform_events')
    .select('owner_id')
    .eq('id', eventId)
    .single()

  if (eventRow) {
    const [{ data: userProfile }, { data: epProfile }] = await Promise.all([
      admin
        .from('platform_users')
        .select('preferred_scene_name, email')
        .eq('id', user.id)
        .single(),
      admin
        .from('platform_users')
        .select('notification_preferences')
        .eq('id', eventRow.owner_id)
        .single(),
    ])

    const displayName = userProfile?.preferred_scene_name?.trim()
      ? userProfile.preferred_scene_name
      : (userProfile?.email?.split('@')[0] ?? 'An attendee')

    const prefs = epProfile?.notification_preferences as Record<string, { in_platform?: boolean }> | null
    if (epWantsInPlatform(prefs, 'ready_to_lock')) {
      void createInPlatformNotification({
        userId: eventRow.owner_id,
        type: 'ready_to_lock',
        title: 'Attendee ready to lock',
        body: `${displayName} has signaled they are ready to lock their attendance.`,
        actionUrl: `/ep/events/${eventId}/attendees/${user.id}`,
        actionLabel: 'Review & Lock',
        eventId,
      })
    }
  }

  return { success: true }
}
