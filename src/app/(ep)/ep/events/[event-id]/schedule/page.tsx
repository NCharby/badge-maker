import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ScheduleManageClient from './ScheduleManageClient'
import type { ActivityRow } from './ScheduleManageClient'

export default async function EpSchedulePage({
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
    .select('id, title')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) notFound()

  const { data: activities } = await supabase
    .from('schedule_activities')
    .select('id, name, date_time, duration_minutes, description, volunteers_requested, volunteer_count, volunteer_shift_duration_minutes, volunteer_shift_date_time')
    .eq('event_id', eventId)
    .order('date_time', { ascending: true })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Schedule
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      <ScheduleManageClient
        eventId={eventId}
        initialActivities={(activities ?? []) as ActivityRow[]}
      />
    </div>
  )
}
