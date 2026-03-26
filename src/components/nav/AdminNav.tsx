import Link from 'next/link'
import { getDisplayName } from '@/types/platform'
import { signOut } from '@/app/actions/auth'

interface AdminNavProps {
  user: {
    preferred_scene_name: string | null
    email: string
    role: string
  } | null
}

export default function AdminNav({ user }: AdminNavProps) {
  const displayName = user ? getDisplayName(user) : ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <nav
      style={{
        background: 'var(--sd-text)',
        borderBottom: '1px solid #2a2a28',
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
          href="/admin/dashboard"
          style={{
            fontWeight: 600,
            fontSize: '1.1rem',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          🐕 SD Platform
        </Link>
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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link
          href="/admin/dashboard"
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          Dashboard
        </Link>
        <Link
          href="/admin/users"
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          Users
        </Link>
        <Link href="/profile" title={displayName}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--sd-red)',
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
            color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', padding: 0,
          }}>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
