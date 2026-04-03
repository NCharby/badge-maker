import { epEventGuard } from '@/lib/auth/ep-guard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { BadgeTemplateConfig } from '@/types/badge-template'
import { getEpPastBadgeTemplates } from './actions'
import BadgeBuilderClient from './BadgeBuilderClient'

export default async function BadgeBuilderPage({
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

  if (!event) notFound()

  // Fetch existing badge template for this event
  const { data: template } = await admin
    .from('badge_templates')
    .select('id, name, config, background_image_url')
    .eq('event_id', eventId)
    .single()

  const existingTemplate = template
    ? {
        name: (template.name as string) ?? '',
        config: template.config as BadgeTemplateConfig,
        backgroundImageUrl: template.background_image_url as string | null,
      }
    : null

  // Fetch past templates from EP's other events
  const pastTemplates = await getEpPastBadgeTemplates(eventId)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}/badge`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          &larr; Badge Management
        </Link>
      </div>

      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--sd-text)',
          marginBottom: '4px',
        }}
      >
        Badge Template Builder
      </h1>
      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--sd-muted)',
          marginBottom: '1.5rem',
        }}
      >
        Design the badge layout for {event.title}
      </p>

      <BadgeBuilderClient
        eventId={eventId}
        existingTemplate={existingTemplate}
        pastTemplates={pastTemplates}
      />
    </div>
  )
}
