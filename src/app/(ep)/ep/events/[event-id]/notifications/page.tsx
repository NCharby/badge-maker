import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NotificationsClient from './NotificationsClient'

async function getBotUsername(): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'force-cache' })
    const data = await res.json()
    return data.ok ? '@' + data.result.username : null
  } catch {
    return null
  }
}

export default async function EventNotificationsPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: event }, botUsername] = await Promise.all([
    supabase
      .from('platform_events')
      .select('id, title, telegram_group, telegram_chat_link, telegram_notification_config, room_lock_in_date')
      .eq('id', eventId)
      .eq('owner_id', user.id)
      .single(),
    getBotUsername(),
  ])

  if (!event) {
    return (
      <div style={{ maxWidth: '640px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Notifications
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        Configure Telegram channel notifications for {event.title}.
      </p>

      <NotificationsClient
        eventId={eventId}
        botUsername={botUsername}
        initialTelegramGroup={event.telegram_group ?? null}
        initialTelegramChatLink={event.telegram_chat_link ?? null}
        initialConfig={event.telegram_notification_config ?? null}
        roomLockInDate={event.room_lock_in_date ?? null}
      />
    </div>
  )
}
