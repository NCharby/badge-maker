import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MembersClient from './MembersClient'

export default async function OrgMembersPage({
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
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/dashboard')

  // Caller's access level
  const { data: callerMembership } = await admin
    .from('organization_members')
    .select('access_level')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: callerProfile } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerLevel = callerProfile?.role === 'system_admin'
    ? 'organization_lead'
    : callerMembership?.access_level ?? null

  if (!callerLevel) redirect('/dashboard')

  // Members
  const { data: members } = await admin
    .from('organization_members')
    .select('id, user_id, access_level, promoted_via_org, created_at, platform_users!inner(email, preferred_scene_name)')
    .eq('organization_id', org.id)
    .order('access_level')

  const memberRows = (members ?? []) as unknown as {
    id: string
    user_id: string
    access_level: string
    promoted_via_org: boolean
    created_at: string
    platform_users: { email: string; preferred_scene_name: string | null }
  }[]

  // Pending invitations
  const { data: invitations } = await admin
    .from('organization_invitations')
    .select('id, email, access_level, status, created_at')
    .eq('organization_id', org.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Members
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {org.name} &middot; {memberRows.length} member{memberRows.length !== 1 ? 's' : ''}
      </p>

      <MembersClient
        orgSlug={orgSlug}
        callerLevel={callerLevel}
        members={memberRows.map(m => ({
          id: m.id,
          userId: m.user_id,
          email: m.platform_users.email,
          displayName: m.platform_users.preferred_scene_name?.trim() || m.platform_users.email.split('@')[0],
          accessLevel: m.access_level,
          createdAt: m.created_at,
        }))}
        pendingInvitations={(invitations ?? []).map(inv => ({
          id: inv.id,
          email: inv.email,
          accessLevel: inv.access_level,
          createdAt: inv.created_at,
        }))}
      />
    </div>
  )
}
