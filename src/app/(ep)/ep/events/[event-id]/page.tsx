import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import EventStatusClient from './EventStatusClient'
import type { WorkflowStatus } from '@/types/platform'

export default async function EpEventPage({
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
    .select('id, title, status, start_date, end_date, location, module_config, workflow_statuses')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
    )
  }

  // Maps module_config keys to the card label they control.
  // venue and room_selection are mutually exclusive — only one will ever be enabled.
  // Attendees is always shown and is not module-gated.
  const MODULE_LABELS: Record<string, string> = {
    ticketing:      'Tickets',
    venue:          'Venue',
    application:    'Application Form',
    volunteering:   'Volunteer',
    room_selection: 'Basic Event Rooms',
    schedule:       'Schedule',
    waiver:         'Waiver',
    badge:          'Badge',
  }
  const moduleConfig = (event.module_config ?? {}) as Record<string, { enabled?: boolean } | undefined>

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}>
        ← Dashboard
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>{event.title}</h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '12px' }}>
          {new Date(event.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {event.location && ` · ${event.location}`}
        </p>
        <EventStatusClient
          eventId={event.id}
          currentStatus={event.status}
          workflowStatuses={(event.workflow_statuses ?? []) as WorkflowStatus[]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Event Details', href: `/ep/events/${eventId}/settings`, icon: '⚙️', desc: 'Edit event title, dates & location' },
          { label: 'Workflow', href: `/ep/events/${eventId}/workflow`, icon: '→', desc: 'Manage custom status phases' },
          { label: 'Modules', href: `/ep/events/${eventId}/modules`, icon: '🧩', desc: 'Configure which modules are active and when they open' },
          { label: 'Attendees', href: `/ep/events/${eventId}/attendees`, icon: '👥', desc: 'Review applications & manage attendees' },
          { label: 'Venue', href: `/ep/events/${eventId}/venue`, icon: '🏛️', desc: 'Manage venue, room matrix, and room assignments' },
          { label: 'Application Form', href: `/ep/events/${eventId}/application/builder`, icon: '📋', desc: 'Build & edit the application form' },
          { label: 'Tickets', href: `/ep/events/${eventId}/tickets`, icon: '🎟️', desc: 'Configure ticket types & pricing' },
          { label: 'Waiver', href: `/ep/events/${eventId}/waiver`, icon: '✍️', desc: 'Waiver configuration and status' },
          { label: 'Basic Event Rooms', href: `/ep/events/${eventId}/rooms`, icon: '🏨', desc: 'Manage the event room matrix' },
          { label: 'Volunteer', href: `/ep/events/${eventId}/volunteer`, icon: '🙋', desc: 'Manage volunteer shifts' },
          { label: 'Schedule', href: `/ep/events/${eventId}/schedule`, icon: '📅', desc: 'Event schedule' },
          { label: 'Badge', href: `/ep/events/${eventId}/badge`, icon: '🎫', desc: 'Badge Maker module' },
        ]
          .filter(item =>
            item.label === 'Event Details' ||
            item.label === 'Workflow' ||
            item.label === 'Modules' ||
            item.label === 'Attendees' ||
            Object.entries(moduleConfig).some(
              ([key, cfg]) => cfg?.enabled && MODULE_LABELS[key] === item.label
            )
          )
          .map(item => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                background: 'var(--sd-card)',
                border: '1px solid var(--sd-border)',
                borderRadius: 'var(--sd-radius)',
                padding: '20px',
                textDecoration: 'none',
                display: 'block',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{item.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{item.desc}</div>
            </Link>
          ))}
      </div>
    </div>
  )
}
