import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import RoomDetailClient from './RoomDetailClient'
import type { AttendeeRoomState } from '../actions'

type ResolvedOccupant = {
  userId: string
  displayName: string
  isRoomLead: boolean
  roomStatus: string
  userLocked: boolean
  roomLeadLocked: boolean
}

type ResolvedApplication = {
  id: string
  applicant_user_id: string
  initiated_by: 'room_lead' | 'roommate'
  created_at: string
  status: string
  display_name: string
  social_media: unknown | null
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ 'event-id': string; 'room-id': string }>
}) {
  const { 'event-id': eventId, 'room-id': roomId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, slug, title, start_date, end_date, room_lock_in_date, module_config')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // EP room locking config
  const moduleConfig = (event.module_config ?? {}) as Record<string, { room_lead_can_lock?: boolean; room_lead_can_lock_with_open_spots?: boolean } | undefined>
  const roomCfg = moduleConfig.room_selection ?? moduleConfig.venue
  const roomLockingConfig = {
    room_lead_can_lock: roomCfg?.room_lead_can_lock ?? false,
    room_lead_can_lock_with_open_spots: roomCfg?.room_lead_can_lock_with_open_spots ?? false,
  }

  // Fetch room (admin — users have no RLS on rooms)
  const { data: room } = await admin
    .from('rooms')
    .select('id, name, number, lodging_type, bed_type, has_kitchen, location_zone, bed_spot_count, min_occupancy, room_daily_rates, room_code')
    .eq('id', roomId)
    .single()
  if (!room) notFound()

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('room_id, room_status, is_room_lead, lock_status, ticket_status, roommate_code, user_locked, room_lead_locked, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee || attendee.ticket_status !== 'Complete') {
    redirect(`/events/${eventId}/rooms`)
  }

  const isMyRoom = attendee.room_id === roomId

  // Current occupants (admin — privacy-resolved)
  const { data: occupantRows } = await admin
    .from('event_attendees')
    .select('user_id, room_status, is_room_lead, user_locked, room_lead_locked')
    .eq('event_id', eventId)
    .eq('room_id', roomId)
    .in('room_status', ['Selected', 'Locked In', 'Verified'])

  let resolvedOccupants: ResolvedOccupant[] = []
  if (occupantRows && occupantRows.length > 0) {
    const occupantUserIds = occupantRows.map(o => o.user_id)
    const { data: profiles } = await admin
      .from('platform_users')
      .select('id, preferred_scene_name, email, roommate_finder_hidden')
      .in('id', occupantUserIds)

    resolvedOccupants = occupantRows.map(occ => {
      const profile = profiles?.find(p => p.id === occ.user_id)
      const displayName = profile?.roommate_finder_hidden
        ? 'Anonymous'
        : (profile?.preferred_scene_name?.trim() || profile?.email?.split('@')[0] || 'Unknown')
      return {
        userId: occ.user_id,
        displayName,
        isRoomLead: occ.is_room_lead,
        roomStatus: occ.room_status,
        userLocked: occ.user_locked ?? false,
        roomLeadLocked: occ.room_lead_locked ?? false,
      }
    })
  }

  // Room Lead: pending applications for this room
  let pendingApplications: ResolvedApplication[] = []
  if (attendee.is_room_lead && isMyRoom) {
    const { data: apps } = await supabase
      .from('roommate_applications')
      .select('id, applicant_user_id, initiated_by, created_at, status')
      .eq('event_id', eventId)
      .eq('room_id', roomId)
      .eq('status', 'pending')

    if (apps && apps.length > 0) {
      const ids = apps.map(a => a.applicant_user_id)
      const { data: profiles } = await admin
        .from('platform_users')
        .select('id, preferred_scene_name, email, roommate_finder_hidden, social_media')
        .in('id', ids)

      pendingApplications = apps.map(app => {
        const p = profiles?.find(x => x.id === app.applicant_user_id)
        const displayName = p?.roommate_finder_hidden
          ? 'Anonymous'
          : (p?.preferred_scene_name?.trim() || p?.email?.split('@')[0] || 'Unknown')
        return {
          id: app.id,
          applicant_user_id: app.applicant_user_id,
          initiated_by: app.initiated_by as 'room_lead' | 'roommate',
          created_at: app.created_at,
          status: app.status,
          display_name: displayName,
          // Spec §6.3: Room Lead sees scene name + social media links; no PII
          social_media: p?.roommate_finder_hidden ? null : (p?.social_media ?? null),
        }
      })
    }
  }

  const attendeeState: AttendeeRoomState = {
    room_id: attendee.room_id ?? null,
    room_status: attendee.room_status,
    is_room_lead: attendee.is_room_lead,
    lock_status: attendee.lock_status,
    ticket_status: attendee.ticket_status,
    ticket_type_name: (attendee.ticket_types as { name: string }[] | null)?.[0]?.name ?? null,
    roommate_code: attendee.roommate_code ?? null,
    user_locked: attendee.user_locked ?? false,
    room_lead_locked: attendee.room_lead_locked ?? false,
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/events/${eventId}/rooms`}
          style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          ← Room Selection
        </Link>
      </div>

      <RoomDetailClient
        eventId={eventId}
        room={{
          id: room.id,
          name: room.name,
          number: room.number ?? null,
          lodging_type: room.lodging_type ?? null,
          bed_type: room.bed_type ?? null,
          has_kitchen: room.has_kitchen ?? false,
          location_zone: room.location_zone ?? null,
          bed_spot_count: room.bed_spot_count,
          min_occupancy: room.min_occupancy,
          room_daily_rates: (room.room_daily_rates ?? null) as Array<{ date: string; amount: number }> | null,
          room_code: room.room_code ?? null,
        }}
        attendee={attendeeState}
        occupants={resolvedOccupants}
        pendingApplications={pendingApplications}
        isMyRoom={isMyRoom}
        eventStartDate={event.start_date}
        eventEndDate={event.end_date}
        roomLockingConfig={roomLockingConfig}
      />
    </div>
  )
}
