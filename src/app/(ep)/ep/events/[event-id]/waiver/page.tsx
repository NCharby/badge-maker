import { epEventGuard } from '@/lib/auth/ep-guard'
import { getDisplayName } from '@/types/platform'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Incomplete: { bg: '#F3F4F6', color: '#6B7280' },
  Completed:  { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  Declined:   { bg: 'var(--sd-red-light)', color: '#991b1b' },
}

export default async function EpWaiverPage({
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

  // Fetch all attendees with waiver status and profile info
  const { data: attendees } = await admin
    .from('event_attendees')
    .select(`
      user_id,
      waiver_status,
      badge_maker_waiver_id,
      platform_users!inner(id, email, preferred_scene_name)
    `)
    .eq('event_id', eventId)
    .order('waiver_status')

  const rows = (attendees ?? []) as unknown as {
    user_id: string
    waiver_status: string
    badge_maker_waiver_id: string | null
    platform_users: { id: string; email: string; preferred_scene_name: string | null }
  }[]

  // Fetch waiver PDFs for completed waivers and generate signed URLs
  const waiverIds = rows.filter(r => r.badge_maker_waiver_id).map(r => r.badge_maker_waiver_id!)
  const waiverPdfs: Record<string, string> = {}
  if (waiverIds.length > 0) {
    const { data: waivers } = await admin
      .from('waivers')
      .select('id, pdf_url, signed_at')
      .in('id', waiverIds)

    for (const w of waivers ?? []) {
      if (!w.pdf_url) continue
      // pdf_url may be a storage path (new) or an old public/signed URL
      const marker = '/storage/v1/object/public/waiver-documents/'
      const idx = w.pdf_url.indexOf(marker)
      const storagePath = idx !== -1
        ? w.pdf_url.substring(idx + marker.length)
        : w.pdf_url.startsWith('pdfs/') ? w.pdf_url : null
      if (storagePath) {
        const { data: signed } = await admin.storage
          .from('waiver-documents')
          .createSignedUrl(storagePath, 60 * 60) // 1 hour
        if (signed?.signedUrl) waiverPdfs[w.id] = signed.signedUrl
      }
    }
  }

  const completedCount = rows.filter(r => r.waiver_status === 'Completed').length
  const totalCount = rows.length

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          &larr; {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
        Waiver Management
      </h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--sd-muted)', marginBottom: '1rem' }}>
        {completedCount} of {totalCount} attendees have signed &middot; {event.title}
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}/waiver/builder`}
          style={{
            display: 'inline-block',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--sd-purple)',
            textDecoration: 'none',
            padding: '8px 16px',
            border: '1px solid var(--sd-purple)',
            borderRadius: '7px',
          }}
        >
          Edit Waiver Template &rarr;
        </Link>
      </div>

      {rows.length === 0 ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
          fontSize: '14px',
        }}>
          No attendees enrolled yet.
        </div>
      ) : (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Attendee', 'Email', 'Status', 'PDF'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pu = row.platform_users
                const displayName = pu ? getDisplayName(pu) : row.user_id.slice(0, 8)
                const badge = STATUS_COLORS[row.waiver_status] ?? STATUS_COLORS['Incomplete']
                const pdfUrl = row.badge_maker_waiver_id ? waiverPdfs[row.badge_maker_waiver_id] : null
                return (
                  <tr
                    key={row.user_id}
                    style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--sd-border)' : 'none' }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sd-text)' }}>
                      <Link
                        href={`/ep/events/${eventId}/attendees/${row.user_id}`}
                        style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px' }}>
                      {pu?.email ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: badge.bg, color: badge.color }}>
                        {row.waiver_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {pdfUrl ? (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
                        >
                          View PDF
                        </a>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
