import { createAdminClient, createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { ModuleConfig, WorkflowStatus } from '@/types/platform'
import { canBeginAttendance } from '@/lib/modules'
import { BrowsePastEvents } from './BrowsePastEvents'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getBannerColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('application') || s === 'published') return 'var(--sd-green)'
  if (s.includes('ticket')) return 'var(--sd-blue)'
  if (s.includes('room')) return 'var(--sd-amber)'
  if (s === 'closed' || s === 'happening now' || s === 'registration') return 'var(--sd-muted)'
  return 'var(--sd-xs)'
}

function getStatusBadge(status: string): { label: string; bg: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes('application')) return { label: 'Apps open', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (s.includes('ticket')) return { label: 'Tickets open', bg: 'var(--sd-blue-light)', color: '#1e40af' }
  if (s.includes('room')) return { label: 'Rooms open', bg: 'var(--sd-amber-light)', color: '#92400e' }
  if (s === 'published') return { label: 'Coming soon', bg: '#F3F4F6', color: '#6B7280' }
  if (s === 'closed') return { label: 'Closed', bg: '#F3F4F6', color: '#6B7280' }
  if (s === 'happening now') return { label: 'Happening now', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (s === 'registration') return { label: 'Registration', bg: 'var(--sd-blue-light)', color: '#1e40af' }
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

// ─── Shared card component ──────────────────────────────────────────────────

type BrowseEvent = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  location: string | null
  status: string
  late_registration_enabled: boolean
  late_registration_email: string | null
}

function EventCard({
  event,
  isEnrolled,
  variant,
}: {
  event: BrowseEvent
  isEnrolled: boolean
  variant: 'upcoming' | 'closing_soon' | 'past'
}) {
  const statusBadge = getStatusBadge(event.status)
  const bannerColor = getBannerColor(event.status)
  const isPast = variant === 'past'
  const isClosingSoon = variant === 'closing_soon'

  return (
    <div
      style={{
        background: 'var(--sd-card)',
        border: `1px solid ${isEnrolled ? '#9FE1CB' : 'var(--sd-border)'}`,
        borderRadius: 'var(--sd-radius)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        opacity: isPast ? 0.7 : 1,
      }}
    >
      <div style={{ height: '6px', background: bannerColor }} />

      <div style={{ padding: '16px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', lineHeight: 1.3, marginBottom: '3px' }}>
              {event.title}
            </div>
          </div>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px',
            whiteSpace: 'nowrap', flexShrink: 0, background: statusBadge.bg, color: statusBadge.color,
          }}>
            {statusBadge.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sd-muted)' }}>
            📅 {formatDateRange(event.start_date, event.end_date)}
          </div>
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sd-muted)' }}>
              📍 {event.location}
            </div>
          )}
        </div>

        {event.description && (
          <p style={{
            fontSize: '13px', color: 'var(--sd-muted)', lineHeight: 1.5, marginBottom: '12px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {event.description}
          </p>
        )}
      </div>

      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--sd-border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
        background: 'var(--sd-card2)',
      }}>
        {isClosingSoon && event.late_registration_enabled && !isEnrolled && (
          <a
            href={`mailto:${event.late_registration_email ?? ''}?subject=Interest in attending: ${encodeURIComponent(event.title)}`}
            style={{
              fontSize: '11px', background: 'var(--sd-amber-light)', color: '#92400e',
              border: 'none', padding: '4px 10px', borderRadius: '99px', fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Contact Promoter
          </a>
        )}
        <Link
          href={`/events/${event.id}`}
          style={{
            fontSize: '11px',
            background: isEnrolled ? 'var(--sd-green-light)' : 'var(--sd-card)',
            color: isEnrolled ? 'var(--sd-green-dark)' : 'var(--sd-text)',
            border: isEnrolled ? 'none' : '1px solid var(--sd-border)',
            padding: '4px 10px', borderRadius: '99px', fontWeight: 600, textDecoration: 'none',
          }}
        >
          {isEnrolled ? 'View my event' : 'View event'}
        </Link>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

const PAST_STATUSES = new Set(['Closed', 'Archived'])

export default async function BrowseEventsPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: events } = await adminSupabase
    .from('platform_events')
    .select('id, title, description, start_date, end_date, location, status, module_config, workflow_statuses, late_registration_enabled, late_registration_email, owner_id')
    .not('status', 'in', '("Draft","Archived")')
    .order('start_date', { ascending: true })

  const { data: attendees } = user
    ? await supabase.from('event_attendees').select('event_id').eq('user_id', user.id)
    : { data: [] }

  const enrolledEventIds = new Set((attendees ?? []).map((a: { event_id: string }) => a.event_id))

  // For "Contact Promoter" — resolve owner emails for events with late_registration_enabled but no custom email
  const ownerIds = new Set(
    (events ?? [])
      .filter(e => e.late_registration_enabled && !e.late_registration_email)
      .map(e => e.owner_id)
  )
  let ownerEmails: Record<string, string> = {}
  if (ownerIds.size > 0) {
    const { data: owners } = await adminSupabase
      .from('platform_users')
      .select('id, email')
      .in('id', Array.from(ownerIds))
    ownerEmails = Object.fromEntries((owners ?? []).map(o => [o.id, o.email]))
  }

  // Classify events into 3 categories
  const upcoming: BrowseEvent[] = []
  const closingSoon: BrowseEvent[] = []
  const past: BrowseEvent[] = []

  for (const event of events ?? []) {
    const browseEvent: BrowseEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      status: event.status,
      late_registration_enabled: event.late_registration_enabled ?? false,
      late_registration_email: event.late_registration_email
        ?? (event.late_registration_enabled ? ownerEmails[event.owner_id] ?? null : null),
    }

    if (PAST_STATUSES.has(event.status)) {
      past.push(browseEvent)
    } else {
      const mc = (event.module_config ?? {}) as Record<string, ModuleConfig | undefined>
      const ws = (event.workflow_statuses ?? []) as WorkflowStatus[]
      const attendable = canBeginAttendance(event.status, mc, ws)

      if (attendable) {
        upcoming.push(browseEvent)
      } else {
        closingSoon.push(browseEvent)
      }
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Browse Events</div>
        <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          Discover events and start your attendance journey.
        </div>
      </div>

      {/* ── Upcoming Events ──────────────────────────────────────────────── */}
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '14px' }}>
        Upcoming · {upcoming.length} event{upcoming.length !== 1 ? 's' : ''}
      </div>

      {upcoming.length === 0 ? (
        <div style={{
          background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)',
          padding: '3rem', textAlign: 'center', color: 'var(--sd-muted)', marginBottom: '32px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No upcoming events</p>
          <p style={{ fontSize: '0.85rem' }}>Check back soon for announcements.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {upcoming.map(event => (
            <EventCard key={event.id} event={event} isEnrolled={enrolledEventIds.has(event.id)} variant="upcoming" />
          ))}
        </div>
      )}

      {/* ── Closing Soon ─────────────────────────────────────────────────── */}
      {closingSoon.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-amber-dark)', marginBottom: '14px' }}>
            Closing Soon · {closingSoon.length} event{closingSoon.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {closingSoon.map(event => (
              <EventCard key={event.id} event={event} isEnrolled={enrolledEventIds.has(event.id)} variant="closing_soon" />
            ))}
          </div>
        </>
      )}

      {/* ── Past Events (collapsed) ──────────────────────────────────────── */}
      {past.length > 0 && (
        <BrowsePastEvents
          events={past}
          enrolledEventIds={Array.from(enrolledEventIds)}
        />
      )}
    </div>
  )
}
