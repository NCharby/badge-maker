import { createAdminClient } from '@/lib/supabase/server'
import type { OrgAccessLevel } from '@/types/platform'

/**
 * Centralized event authorization check.
 *
 * Replaces inline `owner_id = user.id` checks throughout EP Server Actions.
 * Authorization cascade (first match wins):
 *   1. System Admin — always authorized
 *   2. Direct event ownership (owner_id = userId)
 *   3. Org OL or EP membership on the event's organization
 *   4. Module Lead with a grant for the specific module on the specific event
 *
 * @param userId    - The authenticated user's ID
 * @param eventId   - The event to check access for
 * @param options   - Optional: moduleKey restricts check to Module Lead access for that module
 * @returns         - authorized: boolean, orgAccessLevel: the user's org role (if applicable)
 */
export async function checkEventAccess(
  userId: string,
  eventId: string,
  options?: { moduleKey?: string },
): Promise<{
  authorized: boolean
  reason?: 'system_admin' | 'owner' | 'org_member' | 'module_lead' | 'denied'
  orgAccessLevel?: OrgAccessLevel | null
}> {
  const admin = createAdminClient()

  // 1. Check platform role
  const { data: platformUser } = await admin
    .from('platform_users')
    .select('role')
    .eq('id', userId)
    .single()

  if (platformUser?.role === 'system_admin') {
    return { authorized: true, reason: 'system_admin' }
  }

  // 2. Fetch event with org info
  const { data: event } = await admin
    .from('platform_events')
    .select('id, owner_id, organization_id')
    .eq('id', eventId)
    .single()

  if (!event) {
    return { authorized: false, reason: 'denied' }
  }

  // 3. Direct ownership
  if (event.owner_id === userId) {
    return { authorized: true, reason: 'owner' }
  }

  // 4. Org membership check
  if (event.organization_id) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('id, access_level')
      .eq('organization_id', event.organization_id)
      .eq('user_id', userId)
      .single()

    if (membership) {
      const level = membership.access_level as OrgAccessLevel

      // OL and EP have full event access
      if (level === 'organization_lead' || level === 'event_promoter') {
        return { authorized: true, reason: 'org_member', orgAccessLevel: level }
      }

      // Module Lead: check org-wide module grants
      // Grants are stored at the org level; event-level filtering (which modules
      // are enabled on the specific event) is applied downstream in epEventGuard.
      if (level === 'module_lead') {
        if (!options?.moduleKey) {
          // Check if they have ANY module grant in this org
          const { count } = await admin
            .from('organization_module_access')
            .select('*', { count: 'exact', head: true })
            .eq('organization_member_id', membership.id)

          if (count && count > 0) {
            return { authorized: true, reason: 'module_lead', orgAccessLevel: 'module_lead' }
          }
        } else {
          // Check for a specific module grant (org-wide)
          const { data: moduleGrant } = await admin
            .from('organization_module_access')
            .select('id')
            .eq('organization_member_id', membership.id)
            .eq('module_key', options.moduleKey)
            .maybeSingle()

          if (moduleGrant) {
            return { authorized: true, reason: 'module_lead', orgAccessLevel: 'module_lead' }
          }
        }
      }
    }
  }

  return { authorized: false, reason: 'denied' }
}

/**
 * Checks if a user has OL or EP access to a specific organization.
 * Used for org management pages (not event-specific).
 */
export async function checkOrgAccess(
  userId: string,
  organizationId: string,
): Promise<{
  authorized: boolean
  accessLevel?: OrgAccessLevel | null
}> {
  const admin = createAdminClient()

  // System admin always authorized
  const { data: platformUser } = await admin
    .from('platform_users')
    .select('role')
    .eq('id', userId)
    .single()

  if (platformUser?.role === 'system_admin') {
    return { authorized: true, accessLevel: 'organization_lead' }
  }

  const { data: membership } = await admin
    .from('organization_members')
    .select('access_level')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (!membership) {
    return { authorized: false }
  }

  return {
    authorized: true,
    accessLevel: membership.access_level as OrgAccessLevel,
  }
}
