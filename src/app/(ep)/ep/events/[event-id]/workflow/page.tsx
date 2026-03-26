import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import WorkflowManagerClient from './WorkflowManagerClient'
import type { WorkflowStatus } from '@/types/platform'

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, title, status, workflow_statuses')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
    )
  }

  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Event Workflow
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        Define the custom status phases between <strong>Published</strong> and <strong>Event Locked</strong>.
        These phases control when modules open and are visible in the status selector on the event hub.
      </p>

      <WorkflowManagerClient
        eventId={eventId}
        initialStatuses={workflowStatuses}
      />
    </div>
  )
}
