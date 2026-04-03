'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'

interface AvatarMenuProps {
  initials: string
  displayName: string
  avatarBg: string
  hasOrgs?: boolean
}

export default function AvatarMenu({ initials, displayName, avatarBg, hasOrgs = false }: AvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title={displayName}
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
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#fff',
            border: '1px solid var(--sd-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '160px',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={{
              display: 'block',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--sd-text)',
              textDecoration: 'none',
            }}
          >
            Profile
          </Link>
          {hasOrgs && (
            <Link
              href="/profile/organization"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--sd-text)',
                textDecoration: 'none',
                borderTop: '1px solid var(--sd-border)',
              }}
            >
              Organization
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--sd-red)',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--sd-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
