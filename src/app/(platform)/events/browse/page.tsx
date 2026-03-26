import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// Users have no direct RLS access to platform_events (CLAUDE.md §3).
// We use the admin client here since this is a trusted Server Component
// and we apply our own auth check (middleware guarantees authentication).

const MODULE_LABELS: Record<string, string> = {
  application: 'Application',
  ticketing: 'Ticketing',
  waiver: 'Waiver',
  room_selection: 'Rooms',
  volunteering: 'Volunteering',
  schedule: 'Schedule',
  badge: 'Badge maker',
}

function getBannerColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('application') || s === 'published') return 'var(--sd-green)'
  if (s.includes('ticket')) return 'var(--sd-blue)'
  if (s.includes('room')) return 'var(--sd-amber)'
  return 'var(--sd-xs)'
}

function getStatusBadge(status: string): { label: string; bg: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes('application')) return { label: 'Apps open', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (s.includes('ticket')) return { label: 'Tickets open', bg: 'var(--sd-blue-light)', color: '#1e40af' }
  if (s.includes('room')) return { label: 'Rooms open', bg: 'var(--sd-amber-light)', color: '#92400e' }
  if (s === 'published') return { label: 'Coming soon', bg: '#F3F4F6', color: '#6B7280' }
  return { label: status, bg: '#F3F4F6', color: '#6B7280' }
}

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

export default async function BrowseEventsPage() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch published+ events
  const { data: events } = await adminSupabase
    .from('platform_events')
    .select('id, title, description, start_date, end_date, location, status, module_config')
    .not('status', 'in', '("Draft","Archived")')
    .order('start_date', { ascending: true })

  // Fetch this user's attendee records to mark which events they're enrolled in
  const { data: attendees } = user
    ? await supabase.from('event_attendees').select('event_id').eq('user_id', user.id)
    : { data: [] }

  const enrolledEventIds = new Set((attendees || []).map((a: { event_id: string }) => a.event_id))

  const eventList = events || []

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '28px 24px',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Upcoming events</div>
        <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          Events hosted by Shiny Dog Productions
        </div>
      </div>

      {/* Event count */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--sd-muted)',
          marginBottom: '14px',
        }}
      >
        Upcoming · {eventList.length} event{eventList.length !== 1 ? 's' : ''}
      </div>

      {/* Grid */}
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
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No upcoming events</p>
          <p style={{ fontSize: '0.85rem' }}>Check back soon for announcements.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {eventList.map((event: {
            id: string
            title: string
            description: string | null
            start_date: string
            end_date: string
            location: string | null
            status: string
            module_config: Record<string, { enabled?: boolean } | undefined> | null
          }) => {
            const isEnrolled = enrolledEventIds.has(event.id)
            const statusBadge = getStatusBadge(event.status)
            const bannerColor = getBannerColor(event.status)
            const enabledModules = Object.entries(event.module_config || {})
              .filter(([, cfg]) => cfg?.enabled)
              .map(([key]) => MODULE_LABELS[key] || key)

            return (
              <div
                key={event.id}
                style={{
                  background: 'var(--sd-card)',
                  border: `1px solid ${isEnrolled ? '#9FE1CB' : 'var(--sd-border)'}`,
                  borderRadius: 'var(--sd-radius)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Colored top band */}
                <div style={{ height: '6px', background: bannerColor }} />

                <div style={{ padding: '16px', flex: 1 }}>
                  {/* Card top: title + status badge */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--sd-text)',
                          lineHeight: 1.3,
                          marginBottom: '3px',
                        }}
                      >
                        {event.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--sd-xs)' }}>
                        Shiny Dog Productions
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '99px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        background: statusBadge.bg,
                        color: statusBadge.color,
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Meta */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sd-muted)' }}>
                      📅 {formatDateRange(event.start_date, event.end_date)}
                    </div>
                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sd-muted)' }}>
                        📍 {event.location}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--sd-muted)',
                        lineHeight: 1.5,
                        marginBottom: '12px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as React.CSSProperties}
                    >
                      {event.description}
                    </p>
                  )}

                  {/* Module pills */}
                  {enabledModules.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '5px',
                        flexWrap: 'wrap',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--sd-border-light)',
                      }}
                    >
                      {enabledModules.map(label => (
                        <span
                          key={label}
                          style={{
                            fontSize: '11px',
                            background: 'var(--sd-card2)',
                            border: '1px solid var(--sd-border-light)',
                            borderRadius: '99px',
                            padding: '2px 8px',
                            color: 'var(--sd-muted)',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--sd-border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    background: 'var(--sd-card2)',
                  }}
                >
                  {isEnrolled ? (
                    <Link
                      href={`/events/${event.id}`}
                      style={{
                        fontSize: '11px',
                        background: 'var(--sd-green-light)',
                        color: 'var(--sd-green-dark)',
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      View my event →
                    </Link>
                  ) : event.status.toLowerCase().includes('application') || event.status === 'Published' ? (
                    <Link
                      href={`/events/${event.id}/application`}
                      style={{
                        background: 'var(--sd-green)',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Apply now
                    </Link>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--sd-xs)' }}>
                      Applications not yet open
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
