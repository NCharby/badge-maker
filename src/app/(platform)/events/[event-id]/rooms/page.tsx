import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import RoomFinderClient from './RoomFinderClient'
import InvitationBanner from './InvitationBanner'
import type { RoomFinderCard, PendingInvitation, MyApplication, IncomingApplication, AttendeeRoomState } from './actions'

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch event (users have no RLS on platform_events)
  const { data: event } = await admin
    .from('platform_events')
    .select('id, slug, title, start_date, end_date, room_lock_in_date')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('room_id, room_status, is_room_lead, lock_status, ticket_status, roommate_code, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) redirect(`/events/${eventId}`)

  // Guard: must have completed ticket
  if (attendee.ticket_status !== 'Complete') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/events/${eventId}`}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            ← {event.title}
          </Link>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          You need a completed ticket to access Room Selection.
        </p>
      </div>
    )
  }

  // Call RPC (user client — SECURITY DEFINER enforces attendee check)
  const { data: rooms, error: rpcError } = await supabase
    .rpc('get_roommate_finder_cards', { p_event_id: eventId })

  // Pending Room Lead invitations (claimed this user)
  const { data: pendingInvitations } = await supabase
    .from('roommate_applications')
    .select('id, room_id, initiated_by, created_at')
    .eq('event_id', eventId)
    .eq('applicant_user_id', user.id)
    .eq('initiated_by', 'room_lead')
    .eq('status', 'pending')

  // User's own outgoing roommate applications
  const { data: myApplications } = await supabase
    .from('roommate_applications')
    .select('id, room_id, status')
    .eq('event_id', eventId)
    .eq('applicant_user_id', user.id)
    .eq('initiated_by', 'roommate')
    .in('status', ['pending'])

  // Room Lead: incoming applications for their room
  let incomingApplications: IncomingApplication[] = []
  if (attendee.is_room_lead && attendee.room_id) {
    const { data: apps } = await supabase
      .from('roommate_applications')
      .select('id, applicant_user_id, initiated_by, created_at, status')
      .eq('event_id', eventId)
      .eq('room_id', attendee.room_id)
      .eq('initiated_by', 'roommate')
      .eq('status', 'pending')

    if (apps && apps.length > 0) {
      const userIds = apps.map(a => a.applicant_user_id)
      const { data: profiles } = await admin
        .from('platform_users')
        .select('id, preferred_scene_name, email, roommate_finder_hidden, social_media')
        .in('id', userIds)

      incomingApplications = apps.map(app => {
        const profile = profiles?.find(p => p.id === app.applicant_user_id)
        const displayName = profile?.roommate_finder_hidden
          ? 'Anonymous'
          : (profile?.preferred_scene_name?.trim() || profile?.email?.split('@')[0] || 'Unknown')
        return {
          id: app.id,
          applicant_user_id: app.applicant_user_id,
          initiated_by: app.initiated_by as 'room_lead' | 'roommate',
          created_at: app.created_at,
          status: app.status,
          display_name: displayName,
          social_media: profile?.roommate_finder_hidden ? null : (profile?.social_media ?? null),
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

  if (rpcError) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
        {backLink}
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          Unable to load rooms. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      {backLink}

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Room Selection
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      {/* Pending invitations banner */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <InvitationBanner
          invitations={pendingInvitations as PendingInvitation[]}
          rooms={(rooms ?? []) as RoomFinderCard[]}
          eventId={eventId}
        />
      )}

      {/* Room Lead: incoming applications summary */}
      {attendee.is_room_lead && attendee.room_id && incomingApplications.length > 0 && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          <strong>{incomingApplications.length}</strong> pending roommate application{incomingApplications.length !== 1 ? 's' : ''} for your room.{' '}
          <Link
            href={`/events/${eventId}/rooms/${attendee.room_id}`}
            style={{ color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            Manage your room →
          </Link>
        </div>
      )}

      <RoomFinderClient
        eventId={eventId}
        eventTitle={event.title}
        rooms={(rooms ?? []) as RoomFinderCard[]}
        attendee={attendeeState}
        myApplications={(myApplications ?? []) as MyApplication[]}
        lockInDate={event.room_lock_in_date ?? null}
      />
    </div>
  )
}
