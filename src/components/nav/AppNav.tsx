import Link from 'next/link'
import { getDisplayName } from '@/types/platform'
import { signOut } from '@/app/actions/auth'

interface AppNavProps {
  user: {
    preferred_scene_name: string | null
    email: string
    role: string
  } | null
  unreadCount?: number
}

export default function AppNav({ user, unreadCount = 0 }: AppNavProps) {
  const role = user?.role ?? 'user'
  const displayName = user ? getDisplayName(user) : ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const isAdmin = role === 'system_admin'
  const isEp = role === 'event_promoter'

  const navBg = isAdmin ? 'var(--sd-text)' : '#fff'
  const linkColor = isAdmin ? 'rgba(255,255,255,0.7)' : 'var(--sd-muted)'
  const logoColor = isAdmin ? '#fff' : 'var(--sd-text)'
  const avatarBg = isAdmin ? 'var(--sd-red)' : isEp ? 'var(--sd-purple)' : 'var(--sd-green)'
  const logoDest = isAdmin ? '/admin/dashboard' : isEp ? '/ep/dashboard' : '/dashboard'

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
          🐕 SD Platform
        </Link>
        {isAdmin && (
          <span
            style={{
              background: 'var(--sd-red-light)',
              color: 'var(--sd-red)',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
            }}
          >
            System Administrator
          </span>
        )}
        {isEp && (
          <span
            style={{
              background: 'var(--sd-purple-light)',
              color: 'var(--sd-purple)',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
            }}
          >
            Event Promoter
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {(isAdmin || isEp) && (
          <Link
            href={isAdmin ? '/admin/dashboard' : '/ep/dashboard'}
            style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Dashboard
          </Link>
        )}
        <Link href="/events/browse" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
          Browse Events
        </Link>
        <Link href="/dashboard" style={{ color: linkColor, textDecoration: 'none', fontSize: '0.9rem' }}>
          My Attendee Events
        </Link>
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
        <Link href="/profile" title={displayName}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: avatarBg,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {initials}
          </div>
        </Link>
        <form action={signOut}>
          <button type="submit" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: linkColor, fontSize: '0.9rem', padding: 0,
          }}>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
