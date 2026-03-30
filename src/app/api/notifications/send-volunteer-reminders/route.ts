import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInPlatformNotification } from '@/lib/notifications'
import { sendTelegramMessage } from '@/lib/telegram/send'

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

const DEDUP_WINDOW_HOURS = 1 // shorter window for volunteer reminders

// Reminder windows: [hoursBeforeShift, notificationType, title]
const REMINDER_WINDOWS: [number, string, string][] = [
  [24, 'volunteer_reminder_24h', 'Volunteer shift in 24 hours'],
  [8,  'volunteer_reminder_8h',  'Volunteer shift in 8 hours'],
  [3,  'volunteer_reminder_3h',  'Volunteer shift in 3 hours'],
  [1,  'volunteer_reminder_1h',  'Volunteer shift in 1 hour'],
  [0.25, 'volunteer_reminder_15min', 'Volunteer shift in 15 minutes!'],
]

// How wide a time window to accept as "matching" this reminder (±30 min except for 15-min ±10 min)
const WINDOW_TOLERANCE_MINUTES = 30

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Find confirmed signups for shifts starting in the next 25 hours
  const lookAhead = new Date(now.getTime() + 25 * 60 * 60 * 1000)
  const { data: signups, error: signupsError } = await admin
    .from('user_volunteer_signups')
    .select(`
      id,
      user_id,
      event_id,
      volunteer_shifts ( id, name, date_time, event_id )
    `)
    .eq('status', 'confirmed')
    .gte('volunteer_shifts.date_time', now.toISOString())
    .lte('volunteer_shifts.date_time', lookAhead.toISOString())

  if (signupsError) {
    return NextResponse.json({ error: signupsError.message }, { status: 500 })
  }

  let sent = 0
  const errors: string[] = []
  const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  for (const signup of signups ?? []) {
    const shift = signup.volunteer_shifts as any
    if (!shift?.date_time) continue

    const shiftTime = new Date(shift.date_time)
    const hoursUntilShift = (shiftTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    for (const [windowHours, notificationType, title] of REMINDER_WINDOWS) {
      // Check if this signup is within ±WINDOW_TOLERANCE_MINUTES of this reminder window
      const toleranceHours = WINDOW_TOLERANCE_MINUTES / 60
      const diff = Math.abs(hoursUntilShift - windowHours)
      if (diff > toleranceHours) continue

      // Dedup: skip if this reminder type was already sent for this signup
      const { data: existing } = await admin
        .from('platform_notifications')
        .select('id')
        .eq('user_id', signup.user_id)
        .eq('event_id', signup.event_id)
        .eq('notification_type', notificationType)
        .gte('created_at', dedupCutoff)
        .limit(1)

      if (existing && existing.length > 0) continue

      const shiftTimeStr = shiftTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })

      const body =
        windowHours <= 0.25
          ? `Final reminder: your volunteer shift "${shift.name}" starts in 15 minutes.`
          : `Your volunteer shift "${shift.name}" starts at ${shiftTimeStr}.`

      try {
        await createInPlatformNotification({
          userId: signup.user_id,
          type: notificationType as any, // extend NotificationType if needed
          title,
          body,
          eventId: signup.event_id,
          actionUrl: `/events/${signup.event_id}`,
          actionLabel: 'View Volunteer Shifts',
        })
        // Rows 17–21: Telegram to volunteer
        const { data: volunteerTg } = await admin
          .from('platform_users')
          .select('telegram_handle, telegram_verified, telegram_notifications_enabled')
          .eq('id', signup.user_id)
          .single()
        if (volunteerTg?.telegram_handle && volunteerTg.telegram_verified && volunteerTg.telegram_notifications_enabled) {
          void sendTelegramMessage(volunteerTg.telegram_handle, body)
        }
        sent++
      } catch (err) {
        errors.push(`Signup ${signup.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return NextResponse.json({ sent, errors })
}
