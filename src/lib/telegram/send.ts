import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Internal: send a message to any chat_id (numeric for DMs, @channel for channels)
async function sendTelegramRaw(
  chatId: number | string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return { success: false, error: 'Bot token missing' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    if (!data.ok) return { success: false, error: data.description }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Send a DM to a platform user by their platform user ID.
// Silently skips if the user has no telegram_chat_id, telegram is unverified,
// or telegram_notifications_enabled is false.
export async function sendTelegramDM(
  userId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient()
  const { data: user, error } = await admin
    .from('platform_users')
    .select('telegram_chat_id, telegram_verified, telegram_notifications_enabled')
    .eq('id', userId)
    .single()

  if (error || !user) return { success: false, error: 'User not found' }
  if (!user.telegram_chat_id) return { success: false, error: 'No telegram_chat_id' }
  if (!user.telegram_verified) return { success: false, error: 'Telegram not verified' }
  if (!user.telegram_notifications_enabled) return { success: false, error: 'Notifications disabled' }

  return sendTelegramRaw(user.telegram_chat_id, message)
}

// Default message templates for event-specific notifications
const DEFAULT_TEMPLATES: Record<string, string> = {
  status_transition:      '📢 {event_name} update: {new_status}',
  new_attendee_enrolled:  '👋 Welcome to {event_name}, {scene_name}!',
  rooms_open:             '🏨 Room selection is now open for {event_name}!',
  lock_deadline_1week:    '⏰ Room lock-in for {event_name} is in 1 week.',
  lock_deadline_48h:      '⚠️ URGENT: Room lock-in for {event_name} is in 48 hours!',
  event_locked:           '🔒 {event_name} is now locked. See you there!',
}

// Send an event notification to the configured channel, to all confirmed attendees via DM,
// or both — depending on per-type config saved by the EP.
//
// Pass `userId` when a specific user is in context (e.g. new_attendee_enrolled).
// When `send_to_user` is enabled but no userId is provided, DMs fan out to all confirmed attendees.
export async function sendEventChannelMessage(
  eventId: string,
  type: string,
  variables: Record<string, string>,
  userId?: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient()
  const { data: event, error } = await admin
    .from('platform_events')
    .select('telegram_group, telegram_notification_config')
    .eq('id', eventId)
    .single()

  if (error || !event) return { success: false, error: 'Event not found' }

  const config = event.telegram_notification_config as Record<
    string,
    { enabled?: boolean; send_to_channel?: boolean; send_to_user?: boolean; message_template?: string }
  > | null
  const typeConfig = config?.[type]

  // send_to_channel: defaults true; backward-compat with old "enabled" field
  const sendToChannel = !!(event.telegram_group &&
    (typeConfig?.send_to_channel ?? typeConfig?.enabled ?? true))

  // send_to_user: enabled in config — fans out to all attendees or targets the specific userId
  const sendToUser = !!(typeConfig?.send_to_user)

  if (!sendToChannel && !sendToUser) {
    return { success: false, error: 'No delivery targets' }
  }

  const template = typeConfig?.message_template || DEFAULT_TEMPLATES[type] || ''
  if (!template) return { success: false, error: 'No template for type' }

  // Always inject {event_url} so templates can reference it; auto-append link if not already present
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const eventUrl = appUrl ? `${appUrl}/events/${eventId}` : ''
  const allVariables: Record<string, string> = { ...variables, event_url: eventUrl }

  const rendered = template.replace(/\{(\w+)\}/g, (_, key: string) => allVariables[key] ?? `{${key}}`)

  // Append event link unless the rendered message already contains it
  const message = (eventUrl && !rendered.includes(eventUrl))
    ? `${rendered}\n<a href="${eventUrl}">Open event →</a>`
    : rendered

  const results: Array<{ success: boolean; error?: string }> = []

  if (sendToChannel && event.telegram_group) {
    results.push(await sendTelegramRaw(event.telegram_group, message))
  }

  if (sendToUser) {
    if (userId) {
      // Specific user in context (e.g. new_attendee_enrolled, or caller passing attendee.user_id)
      results.push(await sendTelegramDM(userId, message))
    } else {
      // Fan-out: DM all confirmed attendees of this event
      const { data: attendees } = await admin
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('ticket_status', 'Complete')

      const dmResults = await Promise.all(
        (attendees ?? []).map(a => sendTelegramDM(a.user_id, message))
      )
      results.push(...dmResults)
    }
  }

  if (results.length === 0) return { success: false, error: 'No delivery targets' }
  const anySuccess = results.some(r => r.success)
  if (!anySuccess) return { success: false, error: results.map(r => r.error).join('; ') }
  return { success: true }
}
