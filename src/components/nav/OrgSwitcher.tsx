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
    // Full page reload ensures all server AND client components re-initialize
    // with the new org context. router.refresh() only re-renders server components
    // but leaves client state stale (e.g. form fields, selected IDs).
    window.location.reload()
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
