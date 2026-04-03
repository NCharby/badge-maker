import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkEventAccess } from './event-access'

/**
 * EP page guard: authenticates the user and verifies they have EP-level access
 * to the specified event (via ownership, org membership, or system_admin role).
 *
 * Returns the user, admin client, and authorized flag.
 * All EP pages and server actions should use this instead of inline owner_id checks.
 */
export async function epEventGuard(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false as const, user: null, admin: null }

  const access = await checkEventAccess(user.id, eventId)
  if (!access.authorized) return { authorized: false as const, user: null, admin: null }

  const admin = createAdminClient()
  return { authorized: true as const, user, admin }
}

/**
 * EP venue guard: authenticates the user and verifies they have access to the
 * venue via ownership, org membership, or system_admin role.
 */
export async function epVenueGuard(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false as const, user: null, admin: null }

  const admin = createAdminClient()

  // Check platform role
  const { data: pu } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (pu?.role === 'system_admin') {
    return { authorized: true as const, user, admin }
  }

  // Check venue ownership
  const { data: venue } = await admin
    .from('venues')
    .select('owner_id, organization_id')
    .eq('id', venueId)
    .single()

  if (!venue) return { authorized: false as const, user: null, admin: null }

  if (venue.owner_id === user.id) {
    return { authorized: true as const, user, admin }
  }

  // Check org membership
  if (venue.organization_id) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('access_level')
      .eq('organization_id', venue.organization_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership && (membership.access_level === 'organization_lead' || membership.access_level === 'event_promoter')) {
      return { authorized: true as const, user, admin }
    }
  }

  return { authorized: false as const, user: null, admin: null }
}
