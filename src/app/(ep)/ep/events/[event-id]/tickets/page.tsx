import { epEventGuard } from '@/lib/auth/ep-guard'
import Link from 'next/link'
import TicketsClient from './TicketsClient'

export default async function EpTicketsPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return null

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, module_config')
    .eq('id', eventId)
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

  const { data: ticketTypes } = await admin
    .from('ticket_types')
    .select('id, name, description, price, available_count, room_lead, roommate_codes_enabled, volunteer_hours_required, room_required_at_purchase')
    .eq('event_id', eventId)
    .order('created_at')

  // Roommate codes are only available when the room selection workflow is enabled
  const mc = (event.module_config ?? {}) as Record<string, { room_selection_workflow?: boolean } | undefined>
  const roomSelectionWorkflowEnabled = !!(mc.venue?.room_selection_workflow || mc.room_selection?.room_selection_workflow)

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
        roomSelectionWorkflowEnabled={roomSelectionWorkflowEnabled}
      />
    </div>
  )
}
