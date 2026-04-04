import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AppNav from '@/components/nav/AppNav'
import Link from 'next/link'
import type { OrgAccessLevel } from '@/types/platform'
import { getOrgContext } from '@/lib/auth/org-context'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ 'org-slug': string }>
}) {
  const { 'org-slug': orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch org by slug
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug, archived')
    .eq('slug', orgSlug)
    .single()

  if (!org) notFound()

  // Check membership (admin client — RLS uses SECURITY DEFINER funcs, but simpler to use admin here)
  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('preferred_scene_name, email, role')
    .eq('id', user.id)
    .single()

  const isSa = platformUser?.role === 'system_admin'

  const { data: membership } = await admin
    .from('organization_members')
    .select('access_level')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership && !isSa) {
    redirect('/dashboard')
  }

  const accessLevel = (isSa ? 'organization_lead' : membership?.access_level) as OrgAccessLevel

  const { count: unreadCount } = await supabase
    .from('platform_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
    .is('dismissed_at', null)

  const orgCtx = await getOrgContext(user.id, platformUser?.role ?? 'user')

  const navItems = [
    { href: `/org/${orgSlug}/dashboard`, label: 'Overview' },
    { href: `/org/${orgSlug}/members`, label: 'Members' },
    { href: `/org/${orgSlug}/analytics`, label: 'Analytics' },
    { href: `/org/${orgSlug}/settings`, label: 'Settings' },
  ]

  // Only OL and EP see all nav items; ML sees limited nav
  const visibleNav = accessLevel === 'module_lead'
    ? navItems.filter(n => n.label === 'Overview')
    : navItems

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sd-bg)' }}>
      <AppNav user={platformUser} unreadCount={unreadCount ?? 0} orgs={orgCtx.orgs} activeOrgId={orgCtx.activeOrgId} />

      {/* Org sub-nav */}
      <div style={{
        background: 'var(--sd-card)',
        borderBottom: '1px solid var(--sd-border)',
        padding: '0 1.5rem',
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '24px', height: '44px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--sd-text)', marginRight: '8px' }}>
            {org.name}
          </span>
          {org.archived && (
            <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 600, background: 'var(--sd-gray-light)', color: 'var(--sd-gray)' }}>
              Archived
            </span>
          )}
          {visibleNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{ fontSize: '13px', color: 'var(--sd-muted)', textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <main>{children}</main>
    </div>
  )
}
