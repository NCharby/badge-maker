import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import EditEventClient from './EditEventClient'

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, title, description, start_date, end_date, status, room_lock_in_date')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '640px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
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
        Event Details
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      <EditEventClient
        eventId={eventId}
        currentStatus={event.status}
        initialValues={{
          title: event.title,
          description: event.description ?? '',
          start_date: event.start_date,
          end_date: event.end_date,
          room_lock_in_date: event.room_lock_in_date ? event.room_lock_in_date.slice(0, 16) : '',
        }}
      />
    </div>
  )
}
