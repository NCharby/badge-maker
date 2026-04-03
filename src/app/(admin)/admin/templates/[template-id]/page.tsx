import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TemplateDetailClient from './TemplateDetailClient'
import type { TemplateGroup, EventTemplateSnapshot } from '@/types/platform'

const GROUP_LABELS: Record<TemplateGroup, string> = {
  core_config: 'Core Config',
  ticketing: 'Ticketing',
  application_form: 'Application',
  waiver_template: 'Waiver',
  badge_template: 'Badge',
  schedule: 'Schedule',
  volunteering: 'Volunteering',
  basic_event_rooms: 'Rooms',
}

function getGroupSummary(group: TemplateGroup, snapshot: EventTemplateSnapshot): string {
  switch (group) {
    case 'core_config': {
      const statuses = snapshot.core_config?.workflow_statuses?.length ?? 0
      return `${statuses} workflow status${statuses !== 1 ? 'es' : ''}`
    }
    case 'ticketing': {
      const types = snapshot.ticketing?.ticket_types?.length ?? 0
      const merch = snapshot.ticketing?.merchandise?.length ?? 0
      const parts: string[] = []
      if (types > 0) parts.push(`${types} ticket type${types !== 1 ? 's' : ''}`)
      if (merch > 0) parts.push(`${merch} merchandise item${merch !== 1 ? 's' : ''}`)
      return parts.length > 0 ? parts.join(', ') : 'empty'
    }
    case 'application_form': {
      const fields = Array.isArray(snapshot.application_form?.fields)
        ? snapshot.application_form.fields.length
        : 0
      return `${fields} field${fields !== 1 ? 's' : ''}`
    }
    case 'waiver_template':
      return snapshot.waiver_template?.content ? 'content included' : 'empty'
    case 'badge_template':
      return snapshot.badge_template?.name ?? 'unnamed template'
    case 'schedule': {
      const acts = snapshot.schedule?.activities?.length ?? 0
      return `${acts} activit${acts !== 1 ? 'ies' : 'y'}`
    }
    case 'volunteering': {
      const shifts = snapshot.volunteering?.volunteer_shifts?.length ?? 0
      return `${shifts} volunteer shift${shifts !== 1 ? 's' : ''}`
    }
    case 'basic_event_rooms': {
      const rooms = snapshot.basic_event_rooms?.rooms?.length ?? 0
      return `${rooms} room${rooms !== 1 ? 's' : ''}`
    }
    default:
      return ''
  }
}

export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<{ 'template-id': string }>
}) {
  const { 'template-id': templateId } = await params
  const admin = createAdminClient()

  const { data: template } = await admin
    .from('event_templates')
    .select('id, name, description, source_event_id, snapshot, included_groups, include_schedule_times, created_at, updated_at')
    .eq('id', templateId)
    .single()

  if (!template) notFound()

  // Fetch source event title if it still exists
  let sourceEventTitle: string | null = null
  if (template.source_event_id) {
    const { data: srcEvent } = await admin
      .from('platform_events')
      .select('title')
      .eq('id', template.source_event_id)
      .single()
    sourceEventTitle = srcEvent?.title ?? null
  }

  const snapshot = template.snapshot as unknown as EventTemplateSnapshot
  const includedGroups = template.included_groups as TemplateGroup[]

  const groupSummaries = includedGroups.map(g => ({
    group: g,
    label: GROUP_LABELS[g] ?? g,
    summary: getGroupSummary(g, snapshot),
  }))

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/templates" style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
          &larr; Templates
        </Link>
      </div>

      <TemplateDetailClient
        template={{
          id: template.id,
          name: template.name,
          description: template.description,
          sourceEventTitle,
          includedGroups,
          includeScheduleTimes: template.include_schedule_times,
          createdAt: template.created_at,
        }}
        groupSummaries={groupSummaries}
      />
    </div>
  )
}
