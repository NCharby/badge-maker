import { epEventGuard } from '@/lib/auth/ep-guard'
import { getDisplayName } from '@/types/platform'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Incomplete: { bg: '#F3F4F6', color: '#6B7280' },
  Complete:   { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
}

export default async function EpBadgePage({
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

  // Fetch all attendees with badge status and profile info
  const { data: attendees } = await admin
    .from('event_attendees')
    .select(`
      user_id,
      badge_status,
      badge_maker_badge_id,
      platform_users!inner(id, email, preferred_scene_name)
    `)
    .eq('event_id', eventId)
    .order('badge_status')

  const rows = (attendees ?? []) as unknown as {
    user_id: string
    badge_status: string
    badge_maker_badge_id: string | null
    platform_users: { id: string; email: string; preferred_scene_name: string | null }
  }[]

  // Fetch badge data for completed badges
  const badgeIds = rows.filter(r => r.badge_maker_badge_id).map(r => r.badge_maker_badge_id!)
  let badgeNames: Record<string, string> = {}
  if (badgeIds.length > 0) {
    const { data: badges } = await admin
      .from('badges')
      .select('id, badge_name')
      .in('id', badgeIds)

    for (const b of badges ?? []) {
      badgeNames[b.id] = b.badge_name
    }
  }

  const completedCount = rows.filter(r => r.badge_status === 'Complete').length
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
            Badge Management
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--sd-muted)', marginBottom: '1.5rem' }}>
            {completedCount} of {totalCount} attendees have created badges &middot; {event.title}
          </p>
        </div>
        <Link
          href={`/ep/events/${eventId}/badge/builder`}
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--sd-purple)',
            border: 'none',
            borderRadius: 'var(--sd-radius)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Edit Badge Template
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
                {['Attendee', 'Email', 'Status', 'Badge Name'].map(h => (
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
                const badge = STATUS_COLORS[row.badge_status] ?? STATUS_COLORS['Incomplete']
                const badgeName = row.badge_maker_badge_id ? badgeNames[row.badge_maker_badge_id] : null
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
                        {row.badge_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: badgeName ? 'var(--sd-text)' : 'var(--sd-muted)' }}>
                      {badgeName ?? '—'}
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
