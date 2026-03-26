import { createClient } from '@/lib/supabase/server'
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

function getStatusBadge(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s === 'draft')          return { bg: '#F3F4F6', color: '#6B7280' }
  if (s === 'published')      return { bg: 'var(--sd-blue-light)', color: '#1e40af' }
  if (s === 'event locked')   return { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (s === 'archived')       return { bg: '#F3F4F6', color: '#9CA3AF' }
  return { bg: 'var(--sd-amber-light)', color: '#92400e' }
}

export default async function EpDashboardPage() {
  const supabase = await createClient()

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

  // EPs can SELECT their own platform_events rows via RLS (owner_id = auth.uid())
  const { data: events } = user
    ? await supabase
        .from('platform_events')
        .select('id, title, start_date, end_date, location, status, module_config')
        .eq('owner_id', user.id)
        .order('start_date', { ascending: true })
    : { data: [] }

  const eventList = events ?? []
  const draftEvents = eventList.filter((e: { status: string }) => e.status === 'Draft')
  const activeEvents = eventList.filter((e: { status: string }) => e.status !== 'Draft' && e.status !== 'Archived')
  const archivedEvents = eventList.filter((e: { status: string }) => e.status === 'Archived')

  function EventCard({ event }: { event: { id: string; title: string; start_date: string; end_date: string; location: string | null; status: string; module_config: Record<string, { enabled?: boolean } | undefined> | null } }) {
    const badge = getStatusBadge(event.status)
    const enabledModules = Object.entries(event.module_config || {})
      .filter(([, cfg]) => cfg?.enabled)
      .map(([key]) => key.replace('_', ' '))

    return (
      <div
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)' }}>
              {event.title}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '99px', background: badge.bg, color: badge.color, flexShrink: 0 }}>
              {event.status}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
            {event.location && <span>📍 {event.location}</span>}
          </div>
          {enabledModules.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
              {enabledModules.map(m => (
                <span key={m} style={{ fontSize: '11px', background: 'var(--sd-card2)', border: '1px solid var(--sd-border-light)', borderRadius: '99px', padding: '1px 7px', color: 'var(--sd-muted)' }}>
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link
          href={`/ep/events/${event.id}`}
          style={{
            flexShrink: 0,
            padding: '7px 16px',
            background: 'var(--sd-purple)',
            color: '#fff',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Manage →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
            Event Promoter Dashboard
          </h1>
          <p style={{ color: 'var(--sd-muted)', fontSize: '0.9rem' }}>
            Welcome back, {displayName}.
          </p>
        </div>
        <Link
          href="/ep/events/new"
          style={{
            padding: '8px 18px',
            background: 'var(--sd-purple)',
            color: '#fff',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + New Event
        </Link>
      </div>

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
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No events yet</p>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Create your first event to get started.</p>
          <Link
            href="/ep/events/new"
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              background: 'var(--sd-purple)',
              color: '#fff',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {activeEvents.length > 0 && (
            <section>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Active · {activeEvents.length} event{activeEvents.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeEvents.map((event: { id: string; title: string; start_date: string; end_date: string; location: string | null; status: string; module_config: Record<string, { enabled?: boolean } | undefined> | null }) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {draftEvents.length > 0 && (
            <section>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Drafts · {draftEvents.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {draftEvents.map((event: { id: string; title: string; start_date: string; end_date: string; location: string | null; status: string; module_config: Record<string, { enabled?: boolean } | undefined> | null }) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {archivedEvents.length > 0 && (
            <section>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Archived · {archivedEvents.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {archivedEvents.map((event: { id: string; title: string; start_date: string; end_date: string; location: string | null; status: string; module_config: Record<string, { enabled?: boolean } | undefined> | null }) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
