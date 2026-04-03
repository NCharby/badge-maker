import { epEventGuard } from '@/lib/auth/ep-guard'
import Link from 'next/link'
import WaiverBuilderClient from './WaiverBuilderClient'
import { getEpPastWaiverTemplates } from './actions'

export default async function WaiverBuilderPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return null

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>&larr; Dashboard</Link>
      </div>
    )
  }

  // Fetch existing waiver template (if any)
  const { data: existingTemplate } = await admin
    .from('waiver_templates')
    .select('id, content, source_template_id')
    .eq('event_id', eventId)
    .single()

  // Fetch past templates from other events owned by this EP (for copy-on-assign)
  const pastTemplates = await getEpPastWaiverTemplates(eventId)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}/waiver`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          &larr; Waiver Management
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Waiver Template Builder
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
        {existingTemplate ? ' \u00B7 Template configured' : ' \u00B7 No template configured yet'}
      </p>

      <WaiverBuilderClient
        eventId={eventId}
        existingContent={existingTemplate?.content ?? null}
        pastTemplates={pastTemplates}
      />
    </div>
  )
}
