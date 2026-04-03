import { epEventGuard } from '@/lib/auth/ep-guard'
import { getDisplayName } from '@/types/platform'
import Link from 'next/link'
import AttendeeDetailClient from './AttendeeDetailClient'

export default async function EpAttendeeDetailPage({
  params,
}: {
  params: Promise<{ 'event-id': string; 'user-id': string }>
}) {
  const { 'event-id': eventId, 'user-id': targetUserId } = await params
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return null

  const { data: event } = await admin
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (!event) {
    return (
      <div style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>Event not found or access denied.</p>
        <Link href="/ep/dashboard" style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
    )
  }

  // Fetch the attendee's full platform_users profile (EP can see everything)
  // Must use admin client — platform_users RLS only allows users to read own row;
  // there is no policy granting EPs cross-user reads. Service role bypasses RLS.
  const { data: profile } = await admin
    .from('platform_users')
    .select('id, email, preferred_scene_name, other_scene_names, phone, address, zip_code, date_of_birth, telegram_handle, telegram_verified, social_media, profile_picture_url, role')
    .eq('id', targetUserId)
    .single()

  if (!profile) {
    return (
      <div style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>User not found.</p>
        <Link href={`/ep/events/${eventId}/attendees`} style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Attendees</Link>
      </div>
    )
  }

  // Fetch attendee record
  const { data: attendee } = await admin
    .from('event_attendees')
    .select('application_status, ticket_status, waiver_status, badge_status, lock_status, room_status, volunteer_hours_required, order_id, badge_maker_badge_id, badge_maker_waiver_id')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .single()

  if (!attendee) {
    return (
      <div style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--sd-muted)' }}>This user is not enrolled in this event.</p>
        <Link href={`/ep/events/${eventId}/attendees`} style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}>← Attendees</Link>
      </div>
    )
  }

  // Fetch application form + response
  const { data: form } = await admin
    .from('application_forms')
    .select('id, title, fields')
    .eq('event_id', eventId)
    .single()

  const { data: responseRow } = await admin
    .from('application_responses')
    .select('responses, submitted_at')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .single()

  const displayName = getDisplayName(profile)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}/attendees`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          ← Attendees · {event.title}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
        {/* Main — application responses */}
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
            {displayName}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>{profile.email}</p>

          {form && responseRow ? (
            <div style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '16px' }}>
                Application Responses
              </h2>
              {responseRow.submitted_at && (
                <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '16px' }}>
                  Submitted {new Date(responseRow.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(form.fields as { id: string; label: string; type: string; order: number }[])
                  .sort((a, b) => a.order - b.order)
                  .map(field => {
                    const val = (responseRow.responses as Record<string, unknown>)?.[field.id]
                    let displayVal: string
                    if (val === null || val === undefined || val === '') {
                      displayVal = '—'
                    } else if (Array.isArray(val)) {
                      displayVal = val.join(', ') || '—'
                    } else if (typeof val === 'object') {
                      const kv = val as { key?: string; value?: string }
                      displayVal = kv.key && kv.value ? `${kv.key}: ${kv.value}` : (kv.value ?? kv.key ?? '—')
                    } else {
                      displayVal = String(val)
                    }
                    return (
                      <div key={field.id}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          {field.label}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--sd-text)' }}>{displayVal}</div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '24px',
              marginBottom: '24px',
              color: 'var(--sd-muted)',
              fontSize: '14px',
            }}>
              {!form ? 'No application form configured for this event.' : 'No application submitted yet.'}
            </div>
          )}

          {/* Full profile fields for EP */}
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '16px' }}>
              Profile Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              {[
                { label: 'Date of birth', value: profile.date_of_birth },
                { label: 'Phone', value: profile.phone },
                { label: 'Address', value: profile.address },
                { label: 'Zip code', value: profile.zip_code },
                { label: 'Telegram', value: profile.telegram_handle ? `@${profile.telegram_handle}${profile.telegram_verified ? ' ✓' : ' (unverified)'}` : null },
                { label: 'Other names', value: profile.other_scene_names?.join(', ') },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontWeight: 600, color: 'var(--sd-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{row.label}</div>
                  <div style={{ color: row.value ? 'var(--sd-text)' : 'var(--sd-muted)' }}>{row.value ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar — status management */}
        <AttendeeDetailClient
          eventId={eventId}
          targetUserId={targetUserId}
          applicationStatus={attendee.application_status}
          ticketStatus={attendee.ticket_status}
          waiverStatus={attendee.waiver_status}
          badgeStatus={attendee.badge_status}
          lockStatus={attendee.lock_status}
          roomStatus={attendee.room_status}
        />
      </div>
    </div>
  )
}
