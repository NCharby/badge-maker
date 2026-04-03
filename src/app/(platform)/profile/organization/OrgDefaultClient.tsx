'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateDefaultOrganization } from './actions'

const LEVEL_META: Record<string, { label: string; bg: string; color: string }> = {
  organization_lead: { label: 'Organization Lead', bg: 'var(--sd-indigo-light)', color: 'var(--sd-indigo)' },
  event_promoter:    { label: 'Event Promoter',    bg: 'var(--sd-purple-light)', color: 'var(--sd-purple)' },
  module_lead:       { label: 'Module Lead',        bg: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' },
  user:              { label: 'Member',             bg: 'var(--sd-gray-light)',  color: 'var(--sd-gray)' },
}

type OrgRow = {
  id: string
  name: string
  slug: string
  accessLevel: string
}

export default function OrgDefaultClient({
  orgs,
  currentDefaultId,
}: {
  orgs: OrgRow[]
  currentDefaultId: string | null
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(currentDefaultId ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSave() {
    setError('')
    setSuccess(false)
    startTransition(async () => {
      const result = await updateDefaultOrganization(selectedId || null)
      if ('error' in result) setError(result.error)
      else {
        setSuccess(true)
        // Also update the cookie to match
        document.cookie = `active_org=${selectedId || 'none'};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
        router.refresh()
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Default org selector */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--sd-text)' }}>
          Default Organization
        </label>
        <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '12px', marginTop: 0 }}>
          This organization will be selected by default when you log in. You can always switch from the navigation bar.
        </p>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '7px',
            border: '1px solid var(--sd-border)',
            fontSize: '14px',
            color: 'var(--sd-text)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="">No Organization (default)</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-red-border)', background: 'var(--sd-red-light)', color: 'var(--sd-red-dark)' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-green-border)', background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }}>
          Default organization saved.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        style={{
          padding: '10px 24px', borderRadius: '7px', fontSize: '14px', fontWeight: 600, border: 'none',
          background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)', color: '#fff',
          cursor: isPending ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
        }}
      >
        {isPending ? 'Saving...' : 'Save Default'}
      </button>

      {/* Org memberships list */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
          Your Organizations
        </h2>
        {orgs.map(o => {
          const meta = LEVEL_META[o.accessLevel] ?? LEVEL_META.user
          return (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sd-border-light)' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{o.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                  <Link href={`/org/${o.slug}/dashboard`} style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
                    Manage organization &rarr;
                  </Link>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
