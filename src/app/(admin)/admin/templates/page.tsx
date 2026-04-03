import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { TemplateGroup } from '@/types/platform'

const GROUP_BADGE_COLORS: Record<TemplateGroup, { bg: string; color: string }> = {
  core_config: { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  ticketing: { bg: 'var(--sd-purple-light)', color: 'var(--sd-purple)' },
  application_form: { bg: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' },
  waiver_template: { bg: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' },
  badge_template: { bg: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' },
  schedule: { bg: 'var(--sd-blue-light)', color: 'var(--sd-blue)' },
  volunteering: { bg: 'var(--sd-blue-light)', color: 'var(--sd-blue)' },
  basic_event_rooms: { bg: 'var(--sd-indigo-light)', color: 'var(--sd-indigo)' },
}

const GROUP_LABELS: Record<TemplateGroup, string> = {
  core_config: 'Core Config',
  ticketing: 'Ticketing',
  application_form: 'Application',
  waiver_template: 'Waiver',
  badge_template: 'Badge',
  schedule: 'Schedule',
  volunteering: 'Volunteering',
  basic_event_rooms: 'Rooms',
}

export default async function AdminTemplatesPage() {
  const admin = createAdminClient()

  const { data: templates } = await admin
    .from('event_templates')
    .select('id, name, description, included_groups, created_at')
    .order('created_at', { ascending: false })

  const rows = (templates ?? []) as unknown as {
    id: string
    name: string
    description: string
    included_groups: TemplateGroup[]
    created_at: string
  }[]

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
            Event Templates
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--sd-muted)' }}>
            {rows.length} template{rows.length !== 1 ? 's' : ''} on the platform
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
          fontSize: '14px',
        }}>
          No templates yet.
        </div>
      ) : (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Name', 'Description', 'Included Groups', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((tpl, i) => (
                <tr key={tpl.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sd-text)' }}>
                    {tpl.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px', maxWidth: '240px' }}>
                    {tpl.description.length > 60 ? tpl.description.slice(0, 60) + '...' : tpl.description}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {tpl.included_groups.map(g => {
                        const colors = GROUP_BADGE_COLORS[g] ?? { bg: 'var(--sd-gray-light)', color: 'var(--sd-gray)' }
                        return (
                          <span key={g} style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: colors.bg, color: colors.color }}>
                            {GROUP_LABELS[g] ?? g}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {new Date(tpl.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/admin/templates/${tpl.id}`}
                      style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
                    >
                      View &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
