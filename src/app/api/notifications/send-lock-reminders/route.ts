import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInPlatformNotification } from '@/lib/notifications'
import { sendTelegramDM, sendEventChannelMessage } from '@/lib/telegram/send'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.SCHEDULER_SECRET
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

const DEDUP_WINDOW_HOURS = 20

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Find active events with a lock date in the next 8 days
  const windowEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)
  const { data: events, error: eventsError } = await admin
    .from('platform_events')
    .select('id, title, room_lock_in_date')
    .not('status', 'in', '("Draft","Archived","Event Locked","Closed")')
    .gte('room_lock_in_date', now.toISOString())
    .lte('room_lock_in_date', windowEnd.toISOString())

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  let sent = 0
  const errors: string[] = []
  const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  for (const event of events ?? []) {
    const lockDate = new Date(event.room_lock_in_date)
    const hoursUntilLock = (lockDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Determine which row applies: row 13 (≤48h), row 12 (>48h and ≤7 days)
    const isUrgent = hoursUntilLock <= 48
    const notificationType = isUrgent ? 'lock_reminder_48h' : 'lock_reminder_1week'
    const title = isUrgent ? 'Room lock deadline in 48 hours!' : 'Room lock deadline in 1 week'
    const body = isUrgent
      ? `Your room for ${event.title} must be locked within 48 hours. Please complete your room selection now.`
      : `Your room for ${event.title} must be locked within the next week. Please confirm your room selection.`

    // Find attendees without locked rooms who have completed tickets
    const { data: attendees } = await admin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', event.id)
      .eq('ticket_status', 'Complete')
      .not('room_status', 'in', '("Locked In","Verified")')

    // Channel broadcast — once per event per run
    void sendEventChannelMessage(event.id, isUrgent ? 'lock_deadline_48h' : 'lock_deadline_1week', {
      event_name: event.title ?? '',
      lock_in_date: lockDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    })

    for (const attendee of attendees ?? []) {
      // Dedup: skip if this notification type was sent for this event in the last 20 hours
      const { data: existing } = await admin
        .from('platform_notifications')
        .select('id')
        .eq('user_id', attendee.user_id)
        .eq('event_id', event.id)
        .eq('notification_type', notificationType)
        .gte('created_at', dedupCutoff)
        .limit(1)

      if (existing && existing.length > 0) continue

      try {
        await createInPlatformNotification({
          userId: attendee.user_id,
          type: 'lock_reminder_1week' as any, // row 12 / row 13 type; extend NotificationType if needed
          title,
          body,
          eventId: event.id,
          actionUrl: `/events/${event.id}`,
          actionLabel: 'Go to Event',
        })
        // Row 12 / 13: Telegram to attendee
        void sendTelegramDM(attendee.user_id, body)
        sent++
      } catch (err) {
        errors.push(`User ${attendee.user_id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return NextResponse.json({ sent, errors })
}
