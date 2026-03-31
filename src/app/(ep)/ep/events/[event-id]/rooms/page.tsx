import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import RoomsManageClient from './RoomsManageClient'
import EpRoomDashboardClient, { type EpRoomCard, type RoomStats } from '../venue/EpRoomDashboardClient'

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

  // ── Room management dashboard data ────────────────────────────────────────
  let epRooms: EpRoomCard[] = []

  if (rooms.length > 0) {
    const roomIds = rooms.map(r => r.id)

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

    epRooms = rooms.map(r => {
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
        Basic Event Rooms
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Room Matrix management */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Room Matrix
          </h2>
          <RoomsManageClient eventId={eventId} initialRooms={rooms} />
        </div>

        {/* Room management dashboard — shown when rooms exist */}
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
