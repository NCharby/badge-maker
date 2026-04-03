import { createClient, createAdminClient } from '@/lib/supabase/server'
import NewEventClient from './NewEventClient'
import { getOrgContext } from '@/lib/auth/org-context'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: pu } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Get active org from nav cookie
  const { orgs: orgCtx, activeOrgId: cookieOrgId } = await getOrgContext(user.id, pu?.role ?? 'user')
  // Only orgs where user can create events (OL/EP level)
  const userOrgs = orgCtx.filter(o => o.accessLevel === 'organization_lead' || o.accessLevel === 'event_promoter')
  const defaultOrgId = cookieOrgId && userOrgs.some(o => o.id === cookieOrgId)
    ? cookieOrgId
    : userOrgs.length === 1 ? userOrgs[0].id : ''

  // Fetch venues for the active org
  let venues: { id: string; name: string }[] = []
  if (defaultOrgId) {
    const { data } = await admin
      .from('venues')
      .select('id, name')
      .eq('organization_id', defaultOrgId)
      .order('name')
    venues = data ?? []
  }

  // Fetch all event templates
  const { data: templateRows } = await admin
    .from('event_templates')
    .select('id, name, description, included_groups')
    .order('name')
  const templates = (templateRows ?? []) as { id: string; name: string; description: string; included_groups: string[] }[]

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <NewEventClient
        venues={venues}
        organizations={userOrgs}
        defaultOrgId={defaultOrgId}
        templates={templates}
      />
    </div>
  )
}
