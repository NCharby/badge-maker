import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getDisplayName } from '@/types/platform'
import Link from 'next/link'

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-US', opts)}–${e.getDate()}, ${s.getFullYear()}`
}

function getLockBadge(lockStatus: string): { label: string; bg: string; color: string } {
  if (lockStatus === 'Locked')        return { label: 'Locked', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (lockStatus === 'Ready to Lock') return { label: 'Ready to Lock', bg: 'var(--sd-amber-light)', color: '#92400e' }
  return { label: 'In Progress', bg: '#F3F4F6', color: '#6B7280' }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: platformUser } = user
    ? await supabase
        .from('platform_users')
        .select('preferred_scene_name, email, role')
        .eq('id', user.id)
        .single()
    : { data: null }

  const displayName = platformUser ? getDisplayName(platformUser) : ''

  // Fetch this user's attendee records
  const { data: attendees } = user
    ? await supabase
        .from('event_attendees')
        .select('event_id, lock_status, ticket_status, application_status, room_status')
        .eq('user_id', user.id)
    : { data: [] }

  const enrolledEventIds = (attendees ?? []).map((a: { event_id: string }) => a.event_id)

  // Fetch event details via admin client (users have no direct RLS on platform_events)
  const { data: events } = enrolledEventIds.length > 0
    ? await adminSupabase
        .from('platform_events')
        .select('id, title, start_date, end_date, location, status')
        .in('id', enrolledEventIds)
        .neq('status', 'Archived')
        .order('start_date', { ascending: true })
    : { data: [] }

  // Merge attendee status into events
  const attendeeByEventId = Object.fromEntries(
    (attendees ?? []).map((a: { event_id: string; lock_status: string; ticket_status: string; application_status: string; room_status: string }) => [a.event_id, a])
  )

  const eventList = events ?? []

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
        Welcome back, {displayName}
      </h1>
      <p style={{ color: 'var(--sd-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Your upcoming events.
      </p>

      {eventList.length === 0 ? (
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--sd-muted)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎟️</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No events yet</p>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Browse available events to get started.
          </p>
          <Link
            href="/events/browse"
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              background: 'var(--sd-green)',
              color: '#fff',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {eventList.map((event: { id: string; title: string; start_date: string; end_date: string; location: string | null; status: string }) => {
            const attendee = attendeeByEventId[event.id]
            const lockBadge = getLockBadge(attendee?.lock_status ?? 'Unlocked')

            return (
              <div
                key={event.id}
                style={{
                  background: 'var(--sd-card)',
                  border: '1px solid var(--sd-border)',
                  borderRadius: 'var(--sd-radius)',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
                    {event.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
                    {event.location && <span>📍 {event.location}</span>}
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '99px', background: lockBadge.bg, color: lockBadge.color }}>
                      {lockBadge.label}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/events/${event.id}`}
                  style={{
                    flexShrink: 0,
                    padding: '7px 16px',
                    background: 'var(--sd-green)',
                    color: '#fff',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  View event →
                </Link>
              </div>
            )
          })}

          <div style={{ textAlign: 'right', marginTop: '4px' }}>
            <Link
              href="/events/browse"
              style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
            >
              Browse more events →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
