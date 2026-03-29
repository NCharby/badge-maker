import { createAdminClient, createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { count: userCount } = await supabase
    .from('platform_users')
    .select('*', { count: 'exact', head: true })

  // platform_events has no user RLS — must use admin client for count
  const { count: eventCount } = await adminSupabase
    .from('platform_events')
    .select('*', { count: 'exact', head: true })

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}
    >
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--sd-text)',
          marginBottom: '0.25rem',
        }}
      >
        System Administrator Dashboard
      </h1>
      <p style={{ color: 'var(--sd-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Platform overview and configuration.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Platform Users', value: userCount ?? '—', icon: '👥' },
          { label: 'Events', value: eventCount ?? '—', icon: '📅' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--sd-text)' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--sd-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--sd-text)', marginBottom: '1rem' }}>
        Management
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        <a
          href="/admin/users"
          style={{
            display: 'block',
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '1.25rem 1.5rem',
            textDecoration: 'none',
            color: 'var(--sd-text)',
          }}
        >
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>👤</div>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Manage Users</div>
          <div style={{ fontSize: '0.825rem', color: 'var(--sd-muted)' }}>
            View all users, assign Event Promoter role, manage payment providers.
          </div>
        </a>
      </div>
    </div>
  )
}
