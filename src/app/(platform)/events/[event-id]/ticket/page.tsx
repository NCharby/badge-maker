import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TicketCheckoutClient from './TicketCheckoutClient'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch event — users have no RLS on platform_events; use service role
  const adminSupabase = createAdminClient()
  const { data: event } = await adminSupabase
    .from('platform_events')
    .select('id, slug, title, start_date, end_date')
    .eq('id', eventId)
    .single()
  if (!event) redirect('/events/browse')

  // Fetch attendee record (user owns own row)
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, lock_status, ticket_type_id, ticket_purchased_at, order_id, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()
  if (!attendee) redirect('/events/browse')

  const backLink = (
    <div style={{ marginBottom: '1.5rem' }}>
      <Link
        href={`/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
      >
        ← {event.title}
      </Link>
    </div>
  )

  // Already has a ticket — show confirmation state
  if (attendee.ticket_status === 'Complete') {
    const ticketName = (attendee.ticket_types as { name: string }[] | null)?.[0]?.name ?? 'Ticket'
    const purchasedAt = attendee.ticket_purchased_at
      ? `Purchased ${formatDate(attendee.ticket_purchased_at)}`
      : null
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {backLink}
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎟</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '8px' }}>
            You have a ticket!
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>{ticketName}</p>
          {purchasedAt && (
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '4px' }}>{purchasedAt}</p>
          )}
          {attendee.order_id && (
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
              Order #{attendee.order_id.slice(0, 8)}
            </p>
          )}
          <Link
            href={`/events/${eventId}`}
            style={{ display: 'inline-block', marginTop: '20px', padding: '9px 20px', background: 'var(--sd-green)', color: '#fff', borderRadius: '7px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            Back to event hub
          </Link>
        </div>
      </div>
    )
  }

  // Attendance locked — no purchase
  if (attendee.lock_status === 'Locked') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {backLink}
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          Your attendance is locked — no further changes can be made.
        </p>
      </div>
    )
  }

  // Fetch ticket types for this event (user has attendee SELECT RLS)
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name, description, price, available_count, room_lead, volunteer_hours_required, room_required_at_purchase')
    .eq('event_id', eventId)
    .order('price')

  // Fetch merchandise for this event (attendee SELECT RLS; enabled filter matches RLS policy)
  const { data: merchandise } = await supabase
    .from('merchandise')
    .select('id, name, description, price, available_count, image_url, ticket_type_restriction')
    .eq('event_id', eventId)
    .eq('enabled', true)

  // Only fetch volunteer shifts if at least one ticket type requires volunteer hours
  const needsShifts = (ticketTypes ?? []).some(t => t.volunteer_hours_required > 0)
  let volunteerShifts: Array<{ id: string; name: string; date_time: string; duration_minutes: number; capacity: number }> = []
  if (needsShifts) {
    const { data: shifts } = await supabase
      .from('volunteer_shifts')
      .select('id, name, date_time, duration_minutes, capacity')
      .eq('event_id', eventId)
      .order('date_time')
    volunteerShifts = (shifts ?? []) as typeof volunteerShifts
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {backLink}
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Get Your Ticket
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>
      <TicketCheckoutClient
        eventId={eventId}
        ticketTypes={(ticketTypes ?? []) as Parameters<typeof TicketCheckoutClient>[0]['ticketTypes']}
        merchandise={(merchandise ?? []) as Parameters<typeof TicketCheckoutClient>[0]['merchandise']}
        volunteerShifts={volunteerShifts}
      />
    </div>
  )
}
