import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

type Activity = {
  id: string
  name: string
  date_time: string
  duration_minutes: number
  description: string
  volunteers_requested: boolean
  volunteer_count: number | null
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function formatDayHeader(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Schedule is visible to all authenticated users regardless of attendee status.
  // Use admin client — schedule_activities RLS gates on attendee membership.
  const { data: activities } = await admin
    .from('schedule_activities')
    .select('id, name, date_time, duration_minutes, description, volunteers_requested, volunteer_count')
    .eq('event_id', eventId)
    .order('date_time', { ascending: true })

  // Group activities by calendar day
  const days: { key: string; label: string; items: Activity[] }[] = []
  for (const activity of activities ?? []) {
    const key = getDayKey(activity.date_time)
    let day = days.find(d => d.key === key)
    if (!day) {
      day = { key, label: formatDayHeader(activity.date_time), items: [] }
      days.push(day)
    }
    day.items.push(activity as Activity)
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          ← {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Schedule
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      {days.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          No schedule activities have been added yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {days.map(day => (
            <div key={day.key}>
              <h2 style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--sd-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--sd-border)',
              }}>
                {day.label}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {day.items.map(activity => (
                  <div
                    key={activity.id}
                    style={{
                      background: 'var(--sd-card)',
                      border: '1px solid var(--sd-border)',
                      borderRadius: 'var(--sd-radius)',
                      padding: '16px 20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
                          {activity.name}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: activity.description ? '10px' : 0 }}>
                          <span>{formatTime(activity.date_time)}</span>
                          <span>·</span>
                          <span>{formatDuration(activity.duration_minutes)}</span>
                          {activity.volunteers_requested && activity.volunteer_count && (
                            <>
                              <span>·</span>
                              <span style={{ color: 'var(--sd-green)', fontWeight: 600 }}>
                                {activity.volunteer_count} volunteer{activity.volunteer_count !== 1 ? 's' : ''} needed
                              </span>
                            </>
                          )}
                        </div>
                        {activity.description && (
                          <p style={{ fontSize: '13px', color: 'var(--sd-text)', margin: 0, lineHeight: 1.5 }}>
                            {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
