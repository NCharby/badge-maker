'use client'

import { useRouter } from 'next/navigation'

export default function OrgSelector({
  orgs,
  activeOrgId,
  isAdmin,
}: {
  orgs: { id: string; name: string }[]
  activeOrgId: string | null
  isAdmin: boolean
}) {
  const router = useRouter()

  return (
    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-muted)', whiteSpace: 'nowrap' }}>
        {isAdmin ? 'Viewing as:' : 'Organization:'}
      </label>
      <select
        value={activeOrgId ?? ''}
        onChange={e => {
          const val = e.target.value
          router.push(val ? `/ep/dashboard?org=${val}` : '/ep/dashboard')
        }}
        style={{
          padding: '7px 12px',
          borderRadius: '7px',
          border: '1px solid var(--sd-border)',
          fontSize: '14px',
          color: 'var(--sd-text)',
          background: '#fff',
          minWidth: '220px',
        }}
      >
        <option value="">-- Select organization --</option>
        {orgs.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  )
}
