import Link from 'next/link'
import { getDisplayName } from '@/types/platform'
import AvatarMenu from './AvatarMenu'
import OrgSwitcher, { type OrgOption } from './OrgSwitcher'

interface AppNavProps {
  user: {
    preferred_scene_name: string | null
    email: string
    role: string
  } | null
  unreadCount?: number
  orgs?: OrgOption[]
  activeOrgId?: string | null
}

const ROLE_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
  system_admin:       { label: 'System Administrator', bg: 'var(--sd-red-light)', color: 'var(--sd-red)' },
  organization_lead:  { label: 'Organization Lead',    bg: 'var(--sd-indigo-light)', color: 'var(--sd-indigo)' },
  event_promoter:     { label: 'Event Promoter',       bg: 'var(--sd-purple-light)', color: 'var(--sd-purple)' },
  module_lead:        { label: 'Module Lead',           bg: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' },
  user:               { label: 'Member',                bg: 'var(--sd-gray-light)', color: 'var(--sd-gray)' },
}

export default function AppNav({ user, unreadCount = 0, orgs = [], activeOrgId }: AppNavProps) {
  const platformRole = user?.role ?? 'user'
  const displayName = user ? getDisplayName(user) : ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const isAdmin = platformRole === 'system_admin'
  const isEpOrAbove = platformRole === 'event_promoter' || isAdmin

  // Determine the role to display: org-specific if an org is selected, otherwise platform role
  const activeOrg = activeOrgId ? orgs.find(o => o.id === activeOrgId) : null
  const displayRole = isAdmin
    ? 'system_admin'
    : activeOrg
      ? activeOrg.accessLevel
      : null // No role badge when no org selected (for non-admins)

  const roleMeta = displayRole ? ROLE_DISPLAY[displayRole] ?? null : null

  const navBg = isAdmin ? 'var(--sd-text)' : '#fff'
  const linkColor = isAdmin ? 'rgba(255,255,255,0.7)' : 'var(--sd-muted)'
  const logoColor = isAdmin ? '#fff' : 'var(--sd-text)'
  const avatarBg = isAdmin ? 'var(--sd-red)' : isEpOrAbove ? 'var(--sd-purple)' : 'var(--sd-green)'
  const logoDest = isAdmin ? '/admin/dashboard' : isEpOrAbove ? '/ep/dashboard' : '/dashboard'

  // Show org switcher for users who belong to at least one org
  const hasOrgs = orgs.length > 0

  return (
    <nav
      style={{
        background: navBg,
        borderBottom: isAdmin ? '1px solid #2a2a28' : '1px solid var(--sd-border)',
        padding: '0 1.5rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left side: logo + role badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link
          href={logoDest}
          style={{
            fontWeight: 600,
            fontSize: '1.1rem',
            color: logoColor,
            textDecoration: 'none',
          }}
        >
          Lekd
        </Link>

        {roleMeta && (
          <span
            style={{
              background: roleMeta.bg,
              color: roleMeta.color,
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
            }}
          >
            {roleMeta.label}
          </span>
        )}
      </div>

      {/* Right side: nav links + notifications + org selector + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {isAdmin && (
          <Link href="/admin/dashboard" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
            Admin
          </Link>
        )}
        {isEpOrAbove && (
          <Link href="/ep/dashboard" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
            EP Dashboard
          </Link>
        )}
        <Link href="/events/browse" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
          Browse Events
        </Link>
        <Link href="/dashboard" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
          My Attendee Events
        </Link>

        {/* Notifications */}
        <Link
          href="/notifications"
          title="Notifications"
          style={{ position: 'relative', color: linkColor, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🔔</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-8px',
              background: 'var(--sd-red)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '999px',
              minWidth: '16px',
              textAlign: 'center',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Org selector — right side, after notifications */}
        {hasOrgs && (
          <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId ?? null} />
        )}

        {/* Avatar menu */}
        <AvatarMenu
          initials={initials}
          displayName={displayName}
          avatarBg={avatarBg}
          hasOrgs={hasOrgs}
        />
      </div>
    </nav>
  )
}
