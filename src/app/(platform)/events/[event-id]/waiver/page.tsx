import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { deriveFirstLastName } from '@/types/platform'
import type { WorkflowStatus } from '@/types/platform'
import { getModuleOpenState } from '@/lib/modules'
import PlatformWaiverClient from './PlatformWaiverClient'

export default async function WaiverPage({
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
    .select('id, title, slug, status, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('waiver_status, badge_maker_waiver_id, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) {
    redirect(`/events/${eventId}`)
  }

  // Check waiver module gating
  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const waiverCfg = (event.module_config as Record<string, { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined> | null)?.waiver
  if (!waiverCfg?.enabled) redirect(`/events/${eventId}`)

  const waiverModuleState = getModuleOpenState(
    {
      enabled: true,
      required: waiverCfg.required ?? false,
      opens_at_status: waiverCfg.opens_at_status ?? null,
      closes_at_status: waiverCfg.closes_at_status ?? null,
    },
    event.status,
    workflowStatuses,
  )
  if (waiverModuleState === 'not_yet_open') redirect(`/events/${eventId}`)

  // Fetch waiver template for this event
  const { data: waiverTemplate } = await admin
    .from('waiver_templates')
    .select('content')
    .eq('event_id', eventId)
    .single()

  // If no template exists, show a message
  if (!waiverTemplate) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/events/${eventId}`}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            &larr; {event.title}
          </Link>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
          Event Waiver
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          {event.title}
        </p>

        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
            The event waiver has not been configured yet. The event promoter needs to set up the waiver template.
          </p>
        </div>
      </div>
    )
  }

  // Fetch user profile for pre-population (user-scoped — reading own row)
  const { data: profile } = await supabase
    .from('platform_users')
    .select('preferred_scene_name, email, date_of_birth')
    .eq('id', user.id)
    .single()

  if (!profile) redirect(`/events/${eventId}`)

  // Derive first / last name
  const { firstName, lastName } = deriveFirstLastName(profile.preferred_scene_name, profile.email)

  const formattedDob = profile.date_of_birth
    ? new Date(profile.date_of_birth + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : profile.date_of_birth

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          &larr; {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Event Waiver
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      {/* Already completed */}
      {attendee.waiver_status === 'Completed' && await (async () => {
        let pdfSignedUrl: string | null = null
        if (attendee.badge_maker_waiver_id) {
          const { data: waiver } = await admin
            .from('waivers')
            .select('pdf_url')
            .eq('id', attendee.badge_maker_waiver_id)
            .single()
          if (waiver?.pdf_url) {
            const marker = '/storage/v1/object/public/waiver-documents/'
            const idx = waiver.pdf_url.indexOf(marker)
            const storagePath = idx !== -1
              ? waiver.pdf_url.substring(idx + marker.length)
              : waiver.pdf_url.startsWith('pdfs/') ? waiver.pdf_url : null
            if (storagePath) {
              const { data: signed } = await admin.storage
                .from('waiver-documents')
                .createSignedUrl(storagePath, 60 * 60)
              pdfSignedUrl = signed?.signedUrl ?? null
            }
          }
        }
        return (
          <div
            style={{
              background: 'var(--sd-green-light)',
              border: '1px solid var(--sd-green)',
              borderRadius: 'var(--sd-radius)',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--sd-green-dark)',
                marginBottom: '8px',
              }}
            >
              Waiver Signed
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
              You have already signed the waiver for this event.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: pdfSignedUrl ? '16px' : '0' }}>
              A signed PDF copy has been generated and stored for your records.
            </p>
            {pdfSignedUrl && (
              <a
                href={pdfSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--sd-green)',
                  padding: '10px 24px',
                  borderRadius: 'var(--sd-radius)',
                  textDecoration: 'none',
                }}
              >
                View Signed PDF
              </a>
            )}
          </div>
        )
      })()}

      {/* Module closed and waiver not completed */}
      {attendee.waiver_status !== 'Completed' && waiverModuleState === 'closed' && (
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--sd-text)',
              marginBottom: '8px',
            }}
          >
            Waiver Signing is Closed
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
            The waiver signing period for this event has ended. Please contact the event organizer
            if you need assistance.
          </p>
        </div>
      )}

      {/* Module open and waiver not yet completed */}
      {attendee.waiver_status !== 'Completed' && waiverModuleState === 'open' && (
        <PlatformWaiverClient
          eventId={eventId}
          eventTitle={event.title}
          waiverContent={waiverTemplate.content}
          user={{
            firstName,
            lastName,
            email: profile.email,
            dateOfBirth: formattedDob,
          }}
        />
      )}
    </div>
  )
}
