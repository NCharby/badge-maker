import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import VolunteerClient from './VolunteerClient'
import type { ShiftRow } from './VolunteerClient'
import type { WorkflowStatus } from '@/types/platform'
import { getModuleOpenState, type ModuleOpenState } from '@/lib/modules'

export default async function VolunteerPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, status, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('lock_status, volunteer_hours_required')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) {
    redirect(`/events/${eventId}`)
  }

  // Check volunteering module open state
  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const volCfg = (event.module_config as Record<string, { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined> | null)?.volunteering
  if (!volCfg?.enabled) redirect(`/events/${eventId}`)
  let volModuleState: ModuleOpenState = 'open'
  if (volCfg?.enabled) {
    volModuleState = getModuleOpenState(
      { enabled: true, required: volCfg.required ?? false, opens_at_status: volCfg.opens_at_status ?? null, closes_at_status: volCfg.closes_at_status ?? null },
      event.status,
      workflowStatuses,
    )
    if (volModuleState === 'not_yet_open') redirect(`/events/${eventId}`)
  }

  // Fetch shifts (user RLS allows attendees to select volunteer_shifts for their event)
  const { data: shifts } = await supabase
    .from('volunteer_shifts')
    .select('id, name, date_time, duration_minutes, capacity')
    .eq('event_id', eventId)
    .order('date_time', { ascending: true })

  // Fetch user's own confirmed signups
  const { data: mySignups } = await supabase
    .from('user_volunteer_signups')
    .select('id, shift_id, status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  // Fetch per-shift confirmed signup counts (admin — users can only see own signups)
  let signupCounts: Record<string, number> = {}
  if (shifts && shifts.length > 0) {
    const { data: counts } = await admin
      .from('user_volunteer_signups')
      .select('shift_id')
      .in('shift_id', shifts.map(s => s.id))
      .eq('status', 'confirmed')

    if (counts) {
      signupCounts = counts.reduce((acc: Record<string, number>, row: { shift_id: string }) => {
        acc[row.shift_id] = (acc[row.shift_id] ?? 0) + 1
        return acc
      }, {})
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          ← {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Volunteer Shifts
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      <VolunteerClient
        eventId={eventId}
        shifts={(shifts ?? []) as ShiftRow[]}
        mySignups={mySignups ?? []}
        signupCounts={signupCounts}
        hoursRequired={attendee.volunteer_hours_required}
        isLocked={attendee.lock_status === 'Locked' || volModuleState === 'closed'}
      />
    </div>
  )
}
