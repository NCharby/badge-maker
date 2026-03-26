import { createAdminClient, createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ApplicationForm from './ApplicationForm'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Incomplete':    { bg: '#F3F4F6', color: '#6B7280' },
  'In Progress':   { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Needs Review':  { bg: 'var(--sd-amber-light)', color: '#92400e' },
  'Completed':     { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Approved':      { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  'Declined':      { bg: 'var(--sd-red-light)', color: '#991b1b' },
  'Closed':        { bg: '#F3F4F6', color: '#9CA3AF' },
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch event (admin client — users have no RLS on platform_events)
  const { data: event } = await adminSupabase
    .from('platform_events')
    .select('id, title, module_config')
    .eq('id', eventId)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found.</p>
      </div>
    )
  }

  const appModuleConfig = event.module_config?.application
  if (!appModuleConfig?.enabled) {
    return (
      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Applications are not enabled for this event.</p>
      </div>
    )
  }

  // Fetch or auto-create attendee record — applying IS the enrollment step
  const { data: fetchedAttendee } = await supabase
    .from('event_attendees')
    .select('application_status, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  let attendee = fetchedAttendee
  if (!attendee) {
    const { data: newAttendee } = await adminSupabase
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: user.id })
      .select('application_status, lock_status')
      .single()
    if (!newAttendee) {
      return (
        <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
          <p style={{ color: 'var(--sd-muted)' }}>Unable to start application. Please try again.</p>
          <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
            ← Back to event
          </Link>
        </div>
      )
    }
    attendee = newAttendee
  }

  // Fetch application form
  const { data: form } = await supabase
    .from('application_forms')
    .select('id, title, fields')
    .eq('event_id', eventId)
    .single()

  if (!form) {
    return (
      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}>
          ← Back to event
        </Link>
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '32px',
        }}>
          <p style={{ color: 'var(--sd-muted)', textAlign: 'center' }}>
            Applications are not open for this event yet.
          </p>
        </div>
      </div>
    )
  }

  // Fetch existing responses
  const { data: responseRow } = await supabase
    .from('application_responses')
    .select('responses, submitted_at')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  const applicationStatus = attendee.application_status
  const isLocked = attendee.lock_status === 'Locked'
  const badge = STATUS_COLORS[applicationStatus] ?? STATUS_COLORS['Incomplete']

  const readOnly =
    isLocked ||
    applicationStatus === 'Closed' ||
    applicationStatus === 'Approved' ||
    applicationStatus === 'Declined'

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← Back to event
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>
          {form.title ?? 'Application'}
        </h1>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 10px',
          borderRadius: '99px',
          background: badge.bg,
          color: badge.color,
        }}>
          {applicationStatus}
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
        {responseRow?.submitted_at && (
          <> · Submitted {new Date(responseRow.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
        )}
      </p>

      {applicationStatus === 'Approved' && (
        <div style={{
          background: 'var(--sd-green-light)',
          border: '1px solid var(--sd-green)',
          borderRadius: '7px',
          padding: '12px 16px',
          fontSize: '13px',
          color: 'var(--sd-green-dark)',
          marginBottom: '20px',
        }}>
          Your application has been approved.
        </div>
      )}

      {applicationStatus === 'Declined' && (
        <div style={{
          background: 'var(--sd-red-light)',
          border: '1px solid #FCA5A5',
          borderRadius: '7px',
          padding: '12px 16px',
          fontSize: '13px',
          color: '#991b1b',
          marginBottom: '20px',
        }}>
          Your application was not approved for this event.
        </div>
      )}

      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '28px 32px',
      }}>
        {readOnly && !['Approved', 'Declined'].includes(applicationStatus) && (
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px', fontStyle: 'italic' }}>
            {isLocked ? 'Your attendance is locked — this application is read-only.' : 'This application is read-only.'}
          </p>
        )}

        <ApplicationForm
          eventId={eventId}
          formId={form.id}
          fields={form.fields as Parameters<typeof ApplicationForm>[0]['fields']}
          initialResponses={(responseRow?.responses as Record<string, unknown>) ?? {}}
          applicationStatus={applicationStatus}
          isLocked={isLocked}
        />
      </div>
    </div>
  )
}
