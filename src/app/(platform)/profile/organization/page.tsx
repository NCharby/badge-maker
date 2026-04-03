import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import OrgDefaultClient from './OrgDefaultClient'

export default async function ProfileOrganizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch user's org memberships
  const { data: memberships } = await admin
    .from('organization_members')
    .select('access_level, organization_id')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    redirect('/profile')
  }

  const orgIds = memberships.map(m => m.organization_id)
  const { data: orgRows } = await admin
    .from('organizations')
    .select('id, name, slug')
    .in('id', orgIds)
    .order('name')

  const orgs = (orgRows ?? []).map(o => {
    const membership = memberships.find(m => m.organization_id === o.id)
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      accessLevel: membership?.access_level ?? 'user',
    }
  })

  // Current default
  const { data: profile } = await supabase
    .from('platform_users')
    .select('default_organization_id')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/profile" style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
          &larr; Profile
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Organization Settings
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        Configure your default organization and view your memberships.
      </p>

      <OrgDefaultClient
        orgs={orgs}
        currentDefaultId={profile?.default_organization_id ?? null}
      />
    </div>
  )
}
