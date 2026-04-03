import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminOrganizationsPage() {
  const admin = createAdminClient()

  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, slug, archived, payment_provider, created_at, organization_tiers(name)')
    .order('created_at', { ascending: false })

  const rows = (orgs ?? []) as unknown as {
    id: string
    name: string
    slug: string
    archived: boolean
    payment_provider: string | null
    created_at: string
    organization_tiers: { name: string } | null
  }[]

  // Member counts
  const orgIds = rows.map(r => r.id)
  const memberCounts = new Map<string, number>()
  if (orgIds.length > 0) {
    for (const orgId of orgIds) {
      const { count } = await admin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
      memberCounts.set(orgId, count ?? 0)
    }
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
            Organizations
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--sd-muted)' }}>
            {rows.length} organization{rows.length !== 1 ? 's' : ''} on the platform
          </p>
        </div>
        <Link
          href="/admin/organizations/new"
          style={{
            display: 'inline-block',
            padding: '8px 18px',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'var(--sd-green)',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          + New Organization
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
          No organizations yet.
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
                {['Name', 'Slug', 'Tier', 'Members', 'Payment', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((org, i) => (
                <tr key={org.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sd-text)' }}>
                    {org.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px', fontFamily: 'monospace' }}>
                    {org.slug}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: '#E0E7FF', color: '#4338CA' }}>
                      {org.organization_tiers?.name ?? 'unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sd-text)' }}>
                    {memberCounts.get(org.id) ?? 0}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sd-muted)' }}>
                    {org.payment_provider ?? '---'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {org.archived ? (
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: '#F3F4F6', color: '#6B7280' }}>
                        Archived
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
                    >
                      Manage &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
