import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import RoomsManageClient from './RoomsManageClient'

export default async function EpEventRoomsPage({
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
    .select('id, title, module_config')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) notFound()

  // If the Venue module is active, rooms are managed via the Venue page.
  const moduleConfig = (event.module_config ?? {}) as Record<string, { enabled?: boolean } | undefined>
  if (moduleConfig.venue?.enabled) {
    redirect(`/ep/events/${eventId}/venue`)
  }

  const admin = createAdminClient()

  const { data: roomData } = await admin
    .from('rooms')
    .select('id, number, name, description, bed_spot_count, min_occupancy, room_code, lodging_type, bed_type, has_kitchen, location_zone, room_group')
    .eq('event_id', eventId)
    .order('name', { ascending: true })

  const rooms = roomData ?? []

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1.5rem' }}>
        Basic Event Rooms
      </h1>

      <RoomsManageClient eventId={eventId} initialRooms={rooms} />
    </div>
  )
}
