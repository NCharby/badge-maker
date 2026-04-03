import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>
}) {
  const { 'org-slug': orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug, website, payment_provider, archived, organization_tiers(name)')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/dashboard')

  // Stats
  const { count: memberCount } = await admin
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const { count: eventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const { count: venueCount } = await admin
    .from('venues')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  // Recent events
  const { data: recentEvents } = await admin
    .from('platform_events')
    .select('id, title, slug, status, start_date')
    .eq('organization_id', org.id)
    .order('start_date', { ascending: false })
    .limit(5)

  // Members by level
  const { data: membersByLevel } = await admin
    .from('organization_members')
    .select('access_level')
    .eq('organization_id', org.id)

  const levelCounts = { organization_lead: 0, event_promoter: 0, module_lead: 0 }
  for (const m of membersByLevel ?? []) {
    const lvl = m.access_level as keyof typeof levelCounts
    if (lvl in levelCounts) levelCounts[lvl]++
  }

  const tierName = (org.organization_tiers as unknown as { name: string } | null)?.name ?? 'unknown'

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Organization Overview
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {org.name} &middot; {tierName} tier
        {org.website && (
          <> &middot; <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>{org.website}</a></>
        )}
      </p>

      {org.archived && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--sd-radius)', background: 'var(--sd-amber-light)', border: '1px solid #FCD34D', color: '#92400e', fontSize: '13px', marginBottom: '20px' }}>
          This organization is archived. No new events can be created.
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Members', value: memberCount ?? 0, icon: '👥' },
          { label: 'Events', value: eventCount ?? 0, icon: '📅' },
          { label: 'Venues', value: venueCount ?? 0, icon: '🏨' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '16px 20px' }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)' }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Member breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Members by Role
          </h2>
          {[
            { label: 'Organization Leads', count: levelCounts.organization_lead, color: '#4338CA', bg: '#E0E7FF' },
            { label: 'Event Promoters', count: levelCounts.event_promoter, color: 'var(--sd-purple)', bg: 'var(--sd-purple-light)' },
            { label: 'Module Leads', count: levelCounts.module_lead, color: '#92400e', bg: 'var(--sd-amber-light)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--sd-border-light)', fontSize: '13px' }}>
              <span style={{ color: 'var(--sd-text)' }}>{row.label}</span>
              <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: row.bg, color: row.color }}>{row.count}</span>
            </div>
          ))}
          <Link href={`/org/${orgSlug}/members`} style={{ display: 'block', marginTop: '12px', fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
            Manage members &rarr;
          </Link>
        </div>

        {/* Recent events */}
        <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Recent Events
          </h2>
          {(recentEvents ?? []).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No events yet.</p>
          ) : (
            (recentEvents ?? []).map(evt => (
              <div key={evt.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--sd-border-light)', fontSize: '13px' }}>
                <Link href={`/ep/events/${evt.id}`} style={{ color: 'var(--sd-text)', textDecoration: 'none', fontWeight: 500 }}>
                  {evt.title}
                </Link>
                <div style={{ fontSize: '11px', color: 'var(--sd-muted)' }}>
                  {evt.status} &middot; {new Date(evt.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href={`/org/${orgSlug}/members`} style={{ padding: '8px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--sd-border)', background: '#fff', color: 'var(--sd-text)', textDecoration: 'none' }}>
          Manage Members
        </Link>
        <Link href={`/org/${orgSlug}/settings`} style={{ padding: '8px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--sd-border)', background: '#fff', color: 'var(--sd-text)', textDecoration: 'none' }}>
          Organization Settings
        </Link>
      </div>
    </div>
  )
}
