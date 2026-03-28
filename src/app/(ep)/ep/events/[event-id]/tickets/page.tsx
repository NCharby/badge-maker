import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TicketsClient from './TicketsClient'

export default async function EpTicketsPage({
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

  if (!event) {
    return (
      <div style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>
    )
  }

  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name, description, price, available_count, room_lead, roommate_codes_enabled, volunteer_hours_required, room_required_at_purchase')
    .eq('event_id', eventId)
    .order('created_at')

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>
      <TicketsClient
        eventId={eventId}
        eventTitle={event.title}
        ticketTypes={(ticketTypes ?? []) as Parameters<typeof TicketsClient>[0]['ticketTypes']}
      />
    </div>
  )
}
