import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import OrgDetailClient from './OrgDetailClient'

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ 'org-id': string }>
}) {
  const { 'org-id': orgId } = await params
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug, website, logo_url, payment_provider, archived, created_at, organization_tiers(id, name)')
    .eq('id', orgId)
    .single()

  if (!org) notFound()

  // Fetch members with profile info
  const { data: members } = await admin
    .from('organization_members')
    .select('id, user_id, access_level, promoted_via_org, created_at, platform_users!inner(email, preferred_scene_name)')
    .eq('organization_id', orgId)
    .order('access_level')

  const memberRows = (members ?? []) as unknown as {
    id: string
    user_id: string
    access_level: string
    promoted_via_org: boolean
    created_at: string
    platform_users: { email: string; preferred_scene_name: string | null }
  }[]

  // Event count
  const { count: eventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/organizations" style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
          &larr; Organizations
        </Link>
      </div>

      <OrgDetailClient
        org={{
          id: org.id,
          name: org.name,
          slug: org.slug,
          website: org.website ?? null,
          paymentProvider: org.payment_provider ?? null,
          archived: org.archived,
          tierName: (org.organization_tiers as unknown as { name: string } | null)?.name ?? 'unknown',
          createdAt: org.created_at,
        }}
        members={memberRows.map(m => ({
          id: m.id,
          userId: m.user_id,
          email: m.platform_users.email,
          displayName: m.platform_users.preferred_scene_name?.trim() || m.platform_users.email.split('@')[0],
          accessLevel: m.access_level,
          promotedViaOrg: m.promoted_via_org,
          createdAt: m.created_at,
        }))}
        eventCount={eventCount ?? 0}
      />
    </div>
  )
}
