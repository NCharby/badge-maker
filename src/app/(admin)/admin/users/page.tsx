import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

const roleBadge = (role: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    system_admin: { label: 'System Admin', bg: '#EDE9FE', color: '#5B21B6' },
    event_promoter: { label: 'Event Promoter', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
    user: { label: 'User', bg: 'var(--sd-card2)', color: 'var(--sd-muted)' },
  }
  return map[role] ?? map.user
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()
  const { data: users } = await admin
    .from('platform_users')
    .select('id, email, preferred_scene_name, role, payment_provider, created_at')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.25rem' }}>
        <Link
          href="/admin/dashboard"
          style={{ fontSize: '13px', color: 'var(--sd-muted)', textDecoration: 'none' }}
        >
          ← Dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
        Platform Users
      </h1>
      <p style={{ color: 'var(--sd-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {users?.length ?? 0} total
      </p>

      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
              {['Display Name', 'Email', 'Role', 'Payment Provider', 'Joined', ''].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--sd-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u, i) => {
              const badge = roleBadge(u.role)
              const displayName = u.preferred_scene_name || u.email.split('@')[0]
              const joined = new Date(u.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const isEpOrAdmin = u.role === 'event_promoter' || u.role === 'system_admin'
              return (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: i < (users?.length ?? 0) - 1 ? '1px solid var(--sd-border-light)' : 'none',
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--sd-text)' }}>
                    {displayName}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--sd-muted)' }}>{u.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: badge.bg,
                        color: badge.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--sd-muted)' }}>
                    {isEpOrAdmin ? (u.payment_provider ?? 'square') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--sd-muted)', whiteSpace: 'nowrap' }}>
                    {joined}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <Link
                      href={`/admin/users/${u.id}`}
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--sd-green-dark)',
                        textDecoration: 'none',
                      }}
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
