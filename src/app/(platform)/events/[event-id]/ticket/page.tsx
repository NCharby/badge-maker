import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import TicketCheckoutClient from './TicketCheckoutClient'
import type { WorkflowStatus } from '@/types/platform'
import { getModuleOpenState, getOpensAtName } from '@/lib/modules'

function formatDate(dateStr: string): string {
  // Date-only strings (e.g. "2026-03-27") are parsed as UTC midnight, which can shift the
  // displayed date in negative-offset timezones. Anchoring to noon prevents that.
  // TIMESTAMPTZ values already carry timezone info — pass them through as-is.
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
    .select('id, slug, title, start_date, end_date, status, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()
  if (!event) redirect('/events/browse')

  // Fetch attendee record if one exists — may be null for unenrolled users.
  // Completing a ticket purchase IS the enrollment action when no Application module is in use.
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('ticket_status, lock_status, ticket_type_id, ticket_purchased_at, order_id, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  // Check ticketing module open state
  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const ticketingCfg = (event.module_config as Record<string, { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined> | null)?.ticketing
  if (!ticketingCfg?.enabled) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
            ← {event.title}
          </Link>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          Ticketing is not available for this event.
        </p>
      </div>
    )
  }
  if (ticketingCfg?.enabled) {
    const moduleState = getModuleOpenState(
      { enabled: true, required: ticketingCfg.required ?? true, opens_at_status: ticketingCfg.opens_at_status ?? null, closes_at_status: ticketingCfg.closes_at_status ?? null },
      event.status,
      workflowStatuses,
    )
    if (moduleState === 'not_yet_open') {
      const opensAt = getOpensAtName(
        { enabled: true, required: ticketingCfg.required ?? true, opens_at_status: ticketingCfg.opens_at_status ?? null, closes_at_status: ticketingCfg.closes_at_status ?? null },
        workflowStatuses,
      )
      return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
              ← {event.title}
            </Link>
          </div>
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)', marginBottom: opensAt ? '8px' : '0' }}>
              Tickets are not available yet.
            </p>
            {opensAt && (
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                Opens at: <strong>{opensAt}</strong>
              </p>
            )}
          </div>
        </div>
      )
    }
    if (moduleState === 'closed' && attendee?.ticket_status !== 'Complete') {
      return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
              ← {event.title}
            </Link>
          </div>
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
              Ticket sales are closed.
            </p>
          </div>
        </div>
      )
    }
  }

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
  if (attendee?.ticket_status === 'Complete') {
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
  if (attendee?.lock_status === 'Locked') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {backLink}
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          Your attendance is locked — no further changes can be made.
        </p>
      </div>
    )
  }

  // Use admin client for event data — unenrolled users (no attendee record yet) are blocked
  // by attendee-scoped RLS on ticket_types, merchandise, and volunteer_shifts.
  const { data: ticketTypes } = await adminSupabase
    .from('ticket_types')
    .select('id, name, description, price, available_count, room_lead, roommate_codes_enabled, volunteer_hours_required, room_required_at_purchase')
    .eq('event_id', eventId)
    .order('price')

  const hasRoommateCodeFeature = (ticketTypes ?? []).some(
    t => t.room_lead && t.roommate_codes_enabled,
  )

  const { data: merchandise } = await adminSupabase
    .from('merchandise')
    .select('id, name, description, price, available_count, image_url, ticket_type_restriction')
    .eq('event_id', eventId)
    .eq('enabled', true)

  // Only fetch volunteer shifts if at least one ticket type requires volunteer hours
  const needsShifts = (ticketTypes ?? []).some(t => t.volunteer_hours_required > 0)
  let volunteerShifts: Array<{ id: string; name: string; date_time: string; duration_minutes: number; capacity: number }> = []
  if (needsShifts) {
    const { data: shifts } = await adminSupabase
      .from('volunteer_shifts')
      .select('id, name, date_time, duration_minutes, capacity')
      .eq('event_id', eventId)
      .order('date_time')
    volunteerShifts = (shifts ?? []) as typeof volunteerShifts
  }

  // Fetch EP's payment provider — stored on the EP's platform_users record
  const { data: epProviderRow } = await adminSupabase
    .from('platform_events')
    .select('owner_id, platform_users!owner_id(payment_provider)')
    .eq('id', eventId)
    .single()
  const epPaymentProvider =
    (epProviderRow?.platform_users as { payment_provider?: string | null } | null)
      ?.payment_provider === 'paypal' ? 'paypal' : 'square'

  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? ''
  const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? ''
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''
  const squareScriptSrc = process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

  // Determine if any ticket type has a non-zero price (for deciding whether to load payment SDK)
  const hasPaidTickets = (ticketTypes ?? []).some(t => Number(t.price) > 0)

  return (
    <>
      {epPaymentProvider === 'square' && hasPaidTickets && (
        <Script src={squareScriptSrc} strategy="beforeInteractive" />
      )}
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
          hasRoommateCodeFeature={hasRoommateCodeFeature}
          paymentProvider={epPaymentProvider}
          squareAppId={squareAppId}
          squareLocationId={squareLocationId}
          paypalClientId={paypalClientId}
        />
      </div>
    </>
  )
}
