import { epEventGuard } from '@/lib/auth/ep-guard'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ModuleConfigClient from './ModuleConfigClient'
import type { WorkflowStatus } from '@/types/platform'

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) redirect('/login')

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Module Configuration
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '8px' }}>
        Enable modules for this event and configure when each module opens and closes as the event moves through its workflow.
      </p>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        Define custom workflow phases first on the{' '}
        <Link href={`/ep/events/${eventId}/workflow`} style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
          Workflow
        </Link>{' '}
        page — they will appear in the status dropdowns below.
      </p>

      <ModuleConfigClient
        eventId={eventId}
        moduleConfig={(event.module_config ?? {}) as Record<string, {
          enabled?: boolean
          required?: boolean
          opens_at_status?: string | null
          closes_at_status?: string | null
        }>}
        workflowStatuses={(event.workflow_statuses ?? []) as WorkflowStatus[]}
      />
    </div>
  )
}
