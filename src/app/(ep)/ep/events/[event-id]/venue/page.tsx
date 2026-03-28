import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import VenueRoomsManageClient from './VenueRoomsManageClient'

export default async function EpEventVenuePage({
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
    .select('id, title, venue_id, module_config')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) notFound()

  const admin = createAdminClient()

  let venue: {
    id: string
    name: string
    physical_address: string
    website: string | null
    email: string | null
    phone: string | null
    poc_name: string | null
    poc_phone: string | null
    poc_email: string | null
    status: string
    notification_config: Record<string, boolean>
  } | null = null

  let rooms: Array<{
    id: string
    number: string | null
    name: string
    description: string | null
    bed_spot_count: number
    min_occupancy: number
    room_code: string | null
    lodging_type: string | null
    bed_type: string | null
    has_kitchen: boolean
    location_zone: string | null
    room_group: string | null
  }> = []

  if (event.venue_id) {
    const { data: venueData } = await admin
      .from('venues')
      .select('id, name, physical_address, website, email, phone, poc_name, poc_phone, poc_email, status, notification_config')
      .eq('id', event.venue_id)
      .single()
    venue = venueData

    if (venue) {
      const { data: roomData } = await admin
        .from('rooms')
        .select('id, number, name, description, bed_spot_count, min_occupancy, room_code, lodging_type, bed_type, has_kitchen, location_zone, room_group')
        .eq('venue_id', venue.id)
        .order('name', { ascending: true })
      rooms = roomData ?? []
    }
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1.5rem' }}>
        Venue
      </h1>

      {!event.venue_id || !venue ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏛️</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No venue configured for this event</p>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Assign a venue in{' '}
            <Link href={`/ep/events/${eventId}/settings`} style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
              Event Settings
            </Link>
            , or{' '}
            <Link href="/ep/venues/new" style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
              create a new venue
            </Link>
            .
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link
              href={`/ep/events/${eventId}/settings`}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: '1px solid var(--sd-border)',
                borderRadius: '7px',
                fontSize: '13px',
                color: 'var(--sd-muted)',
                textDecoration: 'none',
              }}
            >
              Event Settings →
            </Link>
            <Link
              href="/ep/venues"
              style={{
                padding: '8px 16px',
                background: 'var(--sd-purple)',
                color: '#fff',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Manage Venues →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Venue Info Card */}
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>{venue.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>{venue.physical_address}</div>
              </div>
              <Link
                href={`/ep/venues/${venue.id}?returnTo=/ep/events/${eventId}/venue`}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  background: 'none',
                  border: '1px solid var(--sd-border)',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--sd-purple)',
                  textDecoration: 'none',
                }}
              >
                Venue Settings →
              </Link>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--sd-muted)' }}>
              {venue.website && <span>🌐 <a href={venue.website} target="_blank" rel="noreferrer" style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>{venue.website}</a></span>}
              {venue.email && <span>✉️ {venue.email}</span>}
              {venue.phone && <span>📞 {venue.phone}</span>}
            </div>

            {(venue.poc_name || venue.poc_email || venue.poc_phone) && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--sd-border)',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sd-muted)', marginBottom: '8px' }}>
                  Event Point of Contact
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: 'var(--sd-text)' }}>
                  {venue.poc_name && <span style={{ fontWeight: 500 }}>{venue.poc_name}</span>}
                  {venue.poc_phone && <span style={{ color: 'var(--sd-muted)' }}>{venue.poc_phone}</span>}
                  {venue.poc_email && <span style={{ color: 'var(--sd-muted)' }}>{venue.poc_email}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Room Matrix — inline management */}
          <VenueRoomsManageClient venueId={venue.id} initialRooms={rooms} />
        </div>
      )}
    </div>
  )
}
