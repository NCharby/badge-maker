import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import VenueSelectClient from './VenueSelectClient'
import EpRoomDashboardClient, { type EpRoomCard, type RoomStats } from './EpRoomDashboardClient'

export default async function EpEventVenuePage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Allow system_admin to access any event; EP must own it
  const { data: pu } = await supabase
    .from('platform_users').select('role').eq('id', user.id).single()
  const isAdmin = pu?.role === 'system_admin'

  let eventQuery = supabase
    .from('platform_events')
    .select('id, title, venue_id, module_config')
    .eq('id', eventId)
  if (!isAdmin) eventQuery = eventQuery.eq('owner_id', user.id)
  const { data: event } = await eventQuery.single()

  if (!event) notFound()

  const admin = createAdminClient()

  // Fetch all venues owned by this user for the selector
  const { data: venuesData } = await admin
    .from('venues')
    .select('id, name')
    .eq('owner_id', user.id)
    .order('name')
  const venues = venuesData ?? []

  // Fetch current venue details if one is assigned
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
  } | null = null

  if (event.venue_id) {
    const { data: venueData } = await admin
      .from('venues')
      .select('id, name, physical_address, website, email, phone, poc_name, poc_phone, poc_email')
      .eq('id', event.venue_id)
      .single()
    venue = venueData
  }

  // ── Fetch room dashboard data ──────────────────────────────────────────────
  // Collect rooms for this event (venue-scoped or event-scoped)
  let rawRooms: Array<{
    id: string; name: string; number: string | null; lodging_type: string | null
    bed_type: string | null; bed_spot_count: number; min_occupancy: number
  }> = []

  if (event.venue_id) {
    const { data } = await admin
      .from('rooms')
      .select('id, name, number, lodging_type, bed_type, bed_spot_count, min_occupancy')
      .eq('venue_id', event.venue_id)
      .order('name')
    rawRooms = data ?? []
  } else {
    // Event-scoped rooms (Basic Event Rooms module)
    const { data } = await admin
      .from('rooms')
      .select('id, name, number, lodging_type, bed_type, bed_spot_count, min_occupancy')
      .eq('event_id', eventId)
      .order('name')
    rawRooms = data ?? []
  }

  let epRooms: EpRoomCard[] = []

  if (rawRooms.length > 0) {
    const roomIds = rawRooms.map(r => r.id)

    // Fetch event_room_config rows for this event
    const [{ data: configs }, { data: bedBlockRows }, { data: attendeeRows }] = await Promise.all([
      admin.from('event_room_config')
        .select('room_id, blocked, block_note, reserved, reservation_note, reservation_note_public')
        .eq('event_id', eventId)
        .in('room_id', roomIds),
      admin.from('bed_blocks')
        .select('room_id, bed_number')
        .eq('event_id', eventId)
        .in('room_id', roomIds),
      admin.from('event_attendees')
        .select('user_id, room_id, room_status, is_room_lead, placed_via_code')
        .eq('event_id', eventId)
        .in('room_status', ['Selected', 'Locked In', 'Verified'])
        .not('room_id', 'is', null)
        .in('room_id', roomIds),
    ])

    // Fetch display names for occupants
    const occupantUserIds = (attendeeRows ?? []).map(a => a.user_id)
    const userNameMap = new Map<string, string>()
    if (occupantUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('platform_users')
        .select('id, preferred_scene_name, email')
        .in('id', occupantUserIds)
      for (const p of profiles ?? []) {
        userNameMap.set(p.id, p.preferred_scene_name?.trim() || p.email?.split('@')[0] || 'Unknown')
      }
    }

    const configMap = new Map((configs ?? []).map(c => [c.room_id, c]))
    const bedBlockMap = new Map<string, number[]>()
    for (const b of bedBlockRows ?? []) {
      if (!bedBlockMap.has(b.room_id)) bedBlockMap.set(b.room_id, [])
      bedBlockMap.get(b.room_id)!.push(b.bed_number)
    }
    const occupantMap = new Map<string, typeof attendeeRows>()
    for (const a of attendeeRows ?? []) {
      if (!a.room_id) continue
      if (!occupantMap.has(a.room_id)) occupantMap.set(a.room_id, [])
      occupantMap.get(a.room_id)!.push(a)
    }

    epRooms = rawRooms.map(r => {
      const cfg = configMap.get(r.id)
      const occs = (occupantMap.get(r.id) ?? []).map(a => ({
        user_id: a.user_id,
        display_name: userNameMap.get(a.user_id) ?? 'Unknown',
        room_status: a.room_status,
        placed_via_code: a.placed_via_code ?? false,
        is_room_lead: a.is_room_lead ?? false,
      }))
      return {
        id: r.id,
        name: r.name,
        number: r.number,
        lodging_type: r.lodging_type,
        bed_type: r.bed_type,
        bed_spot_count: r.bed_spot_count,
        min_occupancy: r.min_occupancy,
        blocked: cfg?.blocked ?? false,
        block_note: cfg?.block_note ?? null,
        reserved: cfg?.reserved ?? false,
        reservation_note: cfg?.reservation_note ?? null,
        reservation_note_public: cfg?.reservation_note_public ?? false,
        blocked_beds: bedBlockMap.get(r.id) ?? [],
        occupants: occs,
      }
    })
  }

  // Compute stats
  const stats: RoomStats = {
    total: epRooms.length,
    blocked: epRooms.filter(r => r.blocked).length,
    reserved: epRooms.filter(r => !r.blocked && r.reserved).length,
    occupied: epRooms.filter(r => !r.blocked && !r.reserved && r.occupants.length > 0).length,
    open: epRooms.filter(r => !r.blocked && !r.reserved).reduce(
      (sum, r) => sum + Math.max(0, r.bed_spot_count - r.blocked_beds.length - r.occupants.length),
      0,
    ),
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1.5rem' }}>
        Venue
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Venue selector card */}
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            Assigned Venue
          </div>
          <VenueSelectClient
            eventId={eventId}
            currentVenueId={event.venue_id ?? null}
            venues={venues}
          />
          {venues.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '8px', marginBottom: 0 }}>
              Changing the venue here updates this event only — it does not affect other events using the same venue.{' '}
              <Link href="/ep/venues/new" style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
                Create a new venue →
              </Link>
            </p>
          )}
        </div>

        {/* Venue detail card — shown when a venue is assigned */}
        {venue && (
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
        )}

        {/* No venue assigned — prompt */}
        {!venue && event.venue_id && (
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--sd-muted)',
            fontSize: '13px',
          }}>
            The assigned venue could not be found. It may have been deleted.
          </div>
        )}

        {!event.venue_id && (
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2.5rem',
            textAlign: 'center',
            color: 'var(--sd-muted)',
            fontSize: '13px',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏛️</div>
            <p style={{ fontWeight: 500, marginBottom: '0.5rem', color: 'var(--sd-text)' }}>No venue assigned</p>
            <p style={{ fontSize: '12px', marginBottom: '1.25rem' }}>
              Select a venue above, or{' '}
              <Link href="/ep/venues/new" style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
                create a new one
              </Link>
              .
            </p>
          </div>
        )}

        {/* Inline room dashboard — shown when there are rooms */}
        {epRooms.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
              Room Management
            </h2>
            <EpRoomDashboardClient eventId={eventId} rooms={epRooms} stats={stats} />
          </div>
        )}

      </div>
    </div>
  )
}
