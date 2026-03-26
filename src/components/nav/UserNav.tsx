import Link from 'next/link'
import { getDisplayName } from '@/types/platform'
import { signOut } from '@/app/actions/auth'

interface UserNavProps {
  user: {
    preferred_scene_name: string | null
    email: string
    role: string
  } | null
}

export default function UserNav({ user }: UserNavProps) {
  const displayName = user ? getDisplayName(user) : ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <nav
      style={{
        background: '#fff',
        borderBottom: '1px solid var(--sd-border)',
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
      <Link
        href="/dashboard"
        style={{
          fontWeight: 600,
          fontSize: '1.1rem',
          color: 'var(--sd-text)',
          textDecoration: 'none',
        }}
      >
        🐕 SD Platform
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link
          href="/dashboard"
          style={{ color: 'var(--sd-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          My Events
        </Link>
        <Link
          href="/events/browse"
          style={{ color: 'var(--sd-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          Browse Events
        </Link>
        <Link href="/profile" title={displayName}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--sd-green)',
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
            color: 'var(--sd-muted)', fontSize: '0.9rem', padding: 0,
          }}>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
