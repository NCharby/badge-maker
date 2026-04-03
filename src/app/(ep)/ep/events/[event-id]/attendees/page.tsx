import { epEventGuard } from '@/lib/auth/ep-guard'
import { getDisplayName } from '@/types/platform'
import Link from 'next/link'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Incomplete':    { bg: '#F3F4F6', color: '#6B7280' },
  'In Progress':   { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Needs Review':  { bg: 'var(--sd-amber-light)', color: '#92400e' },
  'Completed':     { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Approved':      { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  'Declined':      { bg: 'var(--sd-red-light)', color: '#991b1b' },
  'Closed':        { bg: '#F3F4F6', color: '#9CA3AF' },
}

const TICKET_COLORS: Record<string, { bg: string; color: string }> = {
  'Incomplete': { bg: '#F3F4F6', color: '#6B7280' },
  'Complete':   { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
}

const TABS = ['All', 'Needs Review', 'Approved', 'Declined', 'In Progress'] as const
type Tab = (typeof TABS)[number]

export default async function EpAttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'event-id': string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { 'event-id': eventId } = await params
  const { tab: rawTab } = await searchParams
  const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'All'

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

  // Fetch attendees with user profile
  // Must use admin client — platform_users RLS only allows users to read own row;
  // there is no policy granting EPs cross-user reads. Service role bypasses RLS.
  const { data: attendees } = await admin
    .from('event_attendees')
    .select(`
      user_id,
      application_status,
      ticket_status,
      waiver_status,
      badge_status,
      lock_status,
      platform_users!inner(id, email, preferred_scene_name)
    `)
    .eq('event_id', eventId)
    .order('application_status')

  const rows = (attendees ?? []) as unknown as {
    user_id: string
    application_status: string
    ticket_status: string
    waiver_status: string
    badge_status: string
    lock_status: string
    platform_users: { id: string; email: string; preferred_scene_name: string | null }
  }[]

  const filtered = activeTab === 'All'
    ? rows
    : rows.filter(r => r.application_status === activeTab)

  const tabCounts = TABS.reduce((acc, t) => {
    acc[t] = t === 'All' ? rows.length : rows.filter(r => r.application_status === t).length
    return acc
  }, {} as Record<Tab, number>)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <Link
          href={`/ep/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none' }}
        >
          ← {event.title}
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
        Attendees
      </h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--sd-muted)', marginBottom: '1.5rem' }}>
        {rows.length} total · {event.title}
      </p>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <Link
            key={tab}
            href={`/ep/events/${eventId}/attendees?tab=${tab}`}
            style={{
              padding: '5px 14px',
              borderRadius: '99px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              background: activeTab === tab ? 'var(--sd-purple)' : 'var(--sd-card)',
              color: activeTab === tab ? '#fff' : 'var(--sd-muted)',
              border: `1px solid ${activeTab === tab ? 'var(--sd-purple)' : 'var(--sd-border)'}`,
            }}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>
                {tabCounts[tab]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
          fontSize: '14px',
        }}>
          No attendees in this category.
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
                {['Scene name', 'Email', 'Application', 'Ticket', 'Waiver', 'Badge', 'Lock'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const pu = row.platform_users
                const displayName = pu ? getDisplayName(pu) : row.user_id.slice(0, 8)
                const appBadge = STATUS_COLORS[row.application_status] ?? STATUS_COLORS['Incomplete']
                const tktBadge = TICKET_COLORS[row.ticket_status] ?? TICKET_COLORS['Incomplete']
                const wvrBadge = STATUS_COLORS[row.waiver_status] ?? STATUS_COLORS['Incomplete']
                const bdgBadge = TICKET_COLORS[row.badge_status] ?? TICKET_COLORS['Incomplete']
                return (
                  <tr
                    key={row.user_id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--sd-border)' : 'none' }}
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
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: appBadge.bg, color: appBadge.color }}>
                        {row.application_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: tktBadge.bg, color: tktBadge.color }}>
                        {row.ticket_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: wvrBadge.bg, color: wvrBadge.color }}>
                        {row.waiver_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: bdgBadge.bg, color: bdgBadge.color }}>
                        {row.badge_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sd-muted)' }}>
                      {row.lock_status}
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
