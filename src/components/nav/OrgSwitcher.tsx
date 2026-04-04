'use client'

export interface OrgOption {
  id: string
  name: string
  slug: string
  accessLevel: string
}

export default function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: OrgOption[]
  activeOrgId: string | null
}) {
  function handleChange(value: string) {
    // "none" = explicit No Organization; empty string should not happen
    const cookieVal = value || 'none'
    document.cookie = `active_org=${cookieVal};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`

    // Redirect to EP dashboard instead of reloading the current page.
    // Pages scoped to a specific event or org (e.g. /ep/events/[id], /org/[slug])
    // may no longer be accessible under the newly selected org. Navigating to
    // the dashboard avoids permission mismatches and gives the user a clean
    // landing page scoped to the new org context.
    const path = window.location.pathname
    if (path.startsWith('/ep/events/') || path.startsWith('/org/')) {
      window.location.href = '/ep/dashboard'
    } else {
      window.location.reload()
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--sd-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Organization
      </span>
      <select
        value={activeOrgId ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid var(--sd-border)',
          fontSize: '0.8rem',
          color: 'var(--sd-text)',
          background: 'var(--sd-card)',
          cursor: 'pointer',
          maxWidth: '180px',
        }}
      >
        <option value="">No Organization</option>
        {orgs.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  )
}
