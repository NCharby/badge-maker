import { epEventGuard } from '@/lib/auth/ep-guard'
import { redirect } from 'next/navigation'
import CreateTemplateClient from './CreateTemplateClient'

export default async function CreateTemplatePage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const { authorized, admin, user } = await epEventGuard(eventId)
  if (!authorized || !admin || !user) return null

  // Only system_admin can create templates
  const { data: pu } = await admin
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (pu?.role !== 'system_admin') {
    redirect(`/ep/events/${eventId}`)
  }

  // Fetch event title
  const { data: event } = await admin
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (!event) {
    redirect(`/ep/events/${eventId}`)
  }

  // Determine which groups have data
  const [
    { count: ticketCount },
    { data: appForm },
    { data: waiverTpl },
    { data: badgeTpl },
    { count: scheduleCount },
    { count: volunteerCount },
    { count: roomCount },
  ] = await Promise.all([
    admin.from('ticket_types').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    admin.from('application_forms').select('id').eq('event_id', eventId).maybeSingle(),
    admin.from('waiver_templates').select('id').eq('event_id', eventId).maybeSingle(),
    admin.from('badge_templates').select('id').eq('event_id', eventId).maybeSingle(),
    admin.from('schedule_activities').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    admin.from('volunteer_shifts').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    admin.from('rooms').select('*', { count: 'exact', head: true }).eq('event_id', eventId).is('venue_id', null),
  ])

  const availableGroups = {
    ticketing: (ticketCount ?? 0) > 0,
    application_form: !!appForm,
    waiver_template: !!waiverTpl,
    badge_template: !!badgeTpl,
    schedule: (scheduleCount ?? 0) > 0,
    volunteering: (volunteerCount ?? 0) > 0,
    basic_event_rooms: (roomCount ?? 0) > 0,
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <CreateTemplateClient
        eventId={event.id}
        eventTitle={event.title}
        availableGroups={availableGroups}
      />
    </div>
  )
}
