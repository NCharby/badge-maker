import { epEventGuard } from '@/lib/auth/ep-guard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getEventFinancialSummary,
  getEventTicketRevenue,
  getEventMerchandiseRevenue,
  getEventAttendeeBreakdown,
  getEventTicketCapacity,
} from '@/lib/analytics/queries'
import { AccountingClient } from './AccountingClient'

function formatEventDates(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const startMonth = monthNames[start.getMonth()]
  const endMonth = monthNames[end.getMonth()]
  const year = end.getFullYear()

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${year}`
  }

  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
}

export default async function EpAccountingPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return null

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, start_date, end_date')
    .eq('id', eventId)
    .single()

  if (!event) notFound()

  const [financial, ticketRevenue, merchandiseRevenue, attendeeBreakdown, ticketCapacity] =
    await Promise.all([
      getEventFinancialSummary(admin, eventId),
      getEventTicketRevenue(admin, eventId),
      getEventMerchandiseRevenue(admin, eventId),
      getEventAttendeeBreakdown(admin, eventId),
      getEventTicketCapacity(admin, eventId),
    ])

  const eventDates = formatEventDates(event.start_date, event.end_date)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        &larr; {event.title}
      </Link>

      <AccountingClient
        eventId={eventId}
        eventTitle={event.title}
        eventDates={eventDates}
        financial={financial}
        ticketRevenue={ticketRevenue}
        merchandiseRevenue={merchandiseRevenue}
        attendeeBreakdown={attendeeBreakdown}
        ticketCapacity={ticketCapacity}
      />
    </div>
  )
}
