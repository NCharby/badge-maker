import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function VenuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: pu } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  let venues: { id: string; name: string; physical_address: string; status: string }[] | null = null

  if (pu?.role === 'system_admin') {
    // Admin sees all venues
    const { data } = await admin
      .from('venues')
      .select('id, name, physical_address, status')
      .order('name', { ascending: true })
    venues = data
  } else {
    // EP sees venues from their orgs + own venues
    const { data: memberships } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .in('access_level', ['organization_lead', 'event_promoter'])

    const orgIds = (memberships ?? []).map(m => m.organization_id)

    if (orgIds.length > 0) {
      const { data } = await admin
        .from('venues')
        .select('id, name, physical_address, status')
        .in('organization_id', orgIds)
        .order('name', { ascending: true })
      venues = data
    } else {
      // Fallback: own venues only
      const { data } = await supabase
        .from('venues')
        .select('id, name, physical_address, status')
        .eq('owner_id', user.id)
        .order('name', { ascending: true })
      venues = data
    }
  }

  const activeVenues = (venues ?? []).filter(v => v.status === 'active')
  const archivedVenues = (venues ?? []).filter(v => v.status === 'archived')

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href="/ep/dashboard"
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← Dashboard
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>Venues</h1>
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)', margin: 0 }}>
            Manage venues and room matrices for your events.
          </p>
        </div>
        <Link
          href="/ep/venues/new"
          style={{
            padding: '8px 16px',
            borderRadius: '7px',
            background: 'var(--sd-purple)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + Create Venue
        </Link>
      </div>

      {(!venues || venues.length === 0) ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '48px',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--sd-muted)', fontSize: '14px', marginBottom: '12px' }}>
            No venues yet.
          </p>
          <Link
            href="/ep/venues/new"
            style={{ color: 'var(--sd-purple)', fontSize: '14px', textDecoration: 'none' }}
          >
            Create your first venue →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active venues */}
          {activeVenues.length > 0 && (
            <section>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Active · {activeVenues.length} venue{activeVenues.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeVenues.map(venue => (
                  <Link
                    key={venue.id}
                    href={`/ep/venues/${venue.id}`}
                    style={{
                      background: 'var(--sd-card)',
                      border: '1px solid var(--sd-border)',
                      borderRadius: 'var(--sd-radius)',
                      padding: '16px 20px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{venue.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{venue.physical_address}</div>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--sd-purple)', flexShrink: 0 }}>Manage →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Archived venues */}
          {archivedVenues.length > 0 && (
            <section>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Archived · {archivedVenues.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {archivedVenues.map(venue => (
                  <Link
                    key={venue.id}
                    href={`/ep/venues/${venue.id}`}
                    style={{
                      background: 'var(--sd-card)',
                      border: '1px solid var(--sd-border)',
                      borderRadius: 'var(--sd-radius)',
                      padding: '16px 20px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: 0.7,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{venue.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{venue.physical_address}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#9CA3AF', borderRadius: '99px', padding: '2px 8px', fontWeight: 600 }}>
                        Archived
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--sd-purple)' }}>View →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
