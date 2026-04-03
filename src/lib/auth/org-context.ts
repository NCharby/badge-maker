import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import type { OrgOption } from '@/components/nav/OrgSwitcher'

/**
 * Fetches the user's org memberships and resolves the active org.
 *
 * Resolution order:
 *   1. `active_org` cookie (set by OrgSwitcher in AppNav)
 *   2. `default_organization_id` from the user's platform_users profile
 *   3. Auto-select if user has exactly one org
 *   4. null (no org selected — "No Organization" mode)
 *
 * For system admins, returns all active orgs.
 * For other users, returns orgs where they have a non-'user' access level.
 * The `orgs` array always includes ALL orgs the user belongs to (for the dropdown).
 */
export async function getOrgContext(userId: string, platformRole: string): Promise<{
  orgs: OrgOption[]
  activeOrgId: string | null
}> {
  const admin = createAdminClient()
  let orgs: OrgOption[] = []

  if (platformRole === 'system_admin') {
    const { data } = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('archived', false)
      .order('name')
    orgs = (data ?? []).map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      accessLevel: 'organization_lead',
    }))
  } else {
    const { data: memberships } = await admin
      .from('organization_members')
      .select('access_level, organization_id')
      .eq('user_id', userId)

    const activeMemberships = (memberships ?? []).filter(m => m.access_level !== 'user')

    if (activeMemberships.length > 0) {
      const orgIds = activeMemberships.map(m => m.organization_id)
      const { data: orgRows } = await admin
        .from('organizations')
        .select('id, name, slug')
        .in('id', orgIds)
        .eq('archived', false)
        .order('name')

      const orgMap = new Map((orgRows ?? []).map(o => [o.id, o]))
      orgs = activeMemberships
        .filter(m => orgMap.has(m.organization_id))
        .map(m => {
          const o = orgMap.get(m.organization_id)!
          return { id: o.id, name: o.name, slug: o.slug, accessLevel: m.access_level }
        })
    }
  }

  // Read active org from cookie
  const cookieStore = await cookies()
  const cookieOrgId = cookieStore.get('active_org')?.value ?? null

  // "none" cookie value = explicit "No Organization" selection
  if (cookieOrgId === 'none') {
    return { orgs, activeOrgId: null }
  }

  // Validate the cookie value is in the user's orgs
  if (cookieOrgId && orgs.some(o => o.id === cookieOrgId)) {
    return { orgs, activeOrgId: cookieOrgId }
  }

  // Fallback: user's default_organization_id from profile
  const { data: profile } = await admin
    .from('platform_users')
    .select('default_organization_id')
    .eq('id', userId)
    .single()

  const defaultOrgId = profile?.default_organization_id
  if (defaultOrgId && orgs.some(o => o.id === defaultOrgId)) {
    return { orgs, activeOrgId: defaultOrgId }
  }

  // Fallback: auto-select if exactly one org
  if (orgs.length === 1) {
    return { orgs, activeOrgId: orgs[0].id }
  }

  return { orgs, activeOrgId: null }
}
