import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FormBuilderClient from './FormBuilderClient'

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify EP owns this event
  const { data: event } = await supabase
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
    )
  }

  // Fetch existing form (if any)
  const { data: existingForm } = await supabase
    .from('application_forms')
    .select('id, title, fields, source_form_id')
    .eq('event_id', eventId)
    .single()

  // Fetch past forms from other events owned by this EP (for copy-on-assign)
  const { data: epEvents } = await supabase
    .from('platform_events')
    .select('id, title')
    .eq('owner_id', user.id)
    .neq('id', eventId)

  const pastForms: { id: string; eventTitle: string; title: string; fields: unknown[] }[] = []
  if (epEvents && epEvents.length > 0) {
    const epEventIds = epEvents.map(e => e.id)
    const { data: forms } = await supabase
      .from('application_forms')
      .select('id, event_id, title, fields')
      .in('event_id', epEventIds)
    if (forms) {
      for (const f of forms) {
        pastForms.push({
          id: f.id,
          eventTitle: epEvents.find(e => e.id === f.event_id)?.title ?? '',
          title: f.title,
          fields: f.fields as unknown[],
        })
      }
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          ← {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Application Form Builder
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
        {existingForm ? ` · Used by applicants` : ' · No form configured yet'}
      </p>

      <FormBuilderClient
        eventId={eventId}
        existingForm={existingForm ? {
          id: existingForm.id,
          title: existingForm.title ?? '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields: existingForm.fields as any,
          sourceFormId: existingForm.source_form_id,
        } : null}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pastForms={pastForms as any}
      />
    </div>
  )
}
