'use server'

import { revalidatePath } from 'next/cache'
import { epEventGuard } from '@/lib/auth/ep-guard'

export type TelegramNotificationTypeConfig = {
  send_to_channel: boolean
  send_to_user: boolean
  message_template: string
}

export type TelegramNotificationConfig = {
  status_transition?: TelegramNotificationTypeConfig
  new_attendee_enrolled?: TelegramNotificationTypeConfig
  rooms_open?: TelegramNotificationTypeConfig
  lock_deadline_1week?: TelegramNotificationTypeConfig
  lock_deadline_48h?: TelegramNotificationTypeConfig
  event_locked?: TelegramNotificationTypeConfig
}

export async function updateEventTelegramConfig(
  eventId: string,
  telegramGroup: string,
  telegramChatLink: string,
  config: TelegramNotificationConfig
) {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Access denied.' }

  const cleanGroup = telegramGroup.trim()
  const cleanChatLink = telegramChatLink.trim()

  const { error } = await admin
    .from('platform_events')
    .update({
      telegram_group: cleanGroup || null,
      telegram_chat_link: cleanChatLink || null,
      telegram_notification_config: config,
    })
    .eq('id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/notifications`)
  return { success: true }
}
