import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MemberDetailClient from './MemberDetailClient'

export default async function OrgMemberDetailPage({
  params,
}: {
  params: Promise<{ 'org-slug': string; 'user-id': string }>
}) {
  const { 'org-slug': orgSlug, 'user-id': targetUserId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch org
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/dashboard')

  // Caller access level
  const { data: callerProfile } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: callerMembership } = await admin
    .from('organization_members')
    .select('access_level')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const callerLevel = callerProfile?.role === 'system_admin'
    ? 'organization_lead'
    : callerMembership?.access_level ?? null

  if (!callerLevel || (callerLevel !== 'organization_lead' && callerLevel !== 'event_promoter')) {
    redirect(`/org/${orgSlug}/members`)
  }

  // Fetch target member
  const { data: member } = await admin
    .from('organization_members')
    .select('id, user_id, access_level, created_at')
    .eq('organization_id', org.id)
    .eq('user_id', targetUserId)
    .single()
  if (!member) redirect(`/org/${orgSlug}/members`)

  // Fetch target user profile
  const { data: targetProfile } = await admin
    .from('platform_users')
    .select('email, preferred_scene_name')
    .eq('id', targetUserId)
    .single()
  if (!targetProfile) redirect(`/org/${orgSlug}/members`)

  const displayName = targetProfile.preferred_scene_name?.trim() || targetProfile.email.split('@')[0]

  // Fetch org events with their module configs (for module assignment UI)
  const { data: orgEvents } = await admin
    .from('platform_events')
    .select('id, title, status, module_config')
    .eq('organization_id', org.id)
    .order('start_date', { ascending: false })

  // Fetch existing module access grants for this member
  const { data: existingGrants } = await admin
    .from('organization_module_access')
    .select('event_id, module_key')
    .eq('organization_member_id', member.id)

  // Build grants map: { eventId: [moduleKey, ...] }
  const grantsMap: Record<string, string[]> = {}
  for (const grant of existingGrants ?? []) {
    if (!grantsMap[grant.event_id]) grantsMap[grant.event_id] = []
    grantsMap[grant.event_id].push(grant.module_key)
  }

  // Build events list with enabled modules
  const events = (orgEvents ?? []).map(e => {
    const mc = (e.module_config ?? {}) as Record<string, { enabled?: boolean }>
    const enabledModules = Object.entries(mc)
      .filter(([, cfg]) => cfg?.enabled)
      .map(([key]) => key)
    return {
      id: e.id,
      title: e.title,
      status: e.status,
      enabledModules,
      grantedModules: grantsMap[e.id] ?? [],
    }
  })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/org/${orgSlug}/members`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        &larr; Members
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        {displayName}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {targetProfile.email}
      </p>

      <MemberDetailClient
        orgSlug={orgSlug}
        memberId={member.id}
        accessLevel={member.access_level}
        events={events}
      />
    </div>
  )
}
