'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTemplate, deleteTemplate } from '../actions'
import type { TemplateGroup } from '@/types/platform'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--sd-border)',
  borderRadius: '7px',
  fontSize: '14px',
  color: 'var(--sd-text)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

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

type TemplateData = {
  id: string
  name: string
  description: string
  sourceEventTitle: string | null
  includedGroups: TemplateGroup[]
  includeScheduleTimes: boolean
  createdAt: string
}

type GroupSummary = {
  group: TemplateGroup
  label: string
  summary: string
}

export default function TemplateDetailClient({
  template,
  groupSummaries,
}: {
  template: TemplateData
  groupSummaries: GroupSummary[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description)

  function doAction(fn: () => Promise<{ success: true } | { error: string }>, successMsg?: string) {
    setActionError('')
    setActionSuccess('')
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) setActionError(result.error)
      else {
        if (successMsg) setActionSuccess(successMsg)
        router.refresh()
      }
    })
  }

  const createdDate = new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
            {template.name}
          </h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--sd-muted)', flexWrap: 'wrap' }}>
            <span>Created {createdDate}</span>
            {template.includeScheduleTimes && (
              <>
                <span>&middot;</span>
                <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--sd-blue-light)', color: 'var(--sd-blue)' }}>
                  Schedule times included
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Delete this template? This action cannot be undone.')) {
              setActionError('')
              setActionSuccess('')
              startTransition(async () => {
                const result = await deleteTemplate(template.id)
                if ('error' in result) setActionError(result.error)
                else router.push('/admin/templates')
              })
            }
          }}
          disabled={isPending}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid var(--sd-red-border)',
            background: '#fff',
            color: 'var(--sd-red)',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          Delete
        </button>
      </div>

      {/* Status messages */}
      {actionError && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-red-border)', background: 'var(--sd-red-light)', color: 'var(--sd-red-dark)', marginBottom: '16px' }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-green-border)', background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)', marginBottom: '16px' }}>
          {actionSuccess}
        </div>
      )}

      {/* Details card */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Source Event</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>
              {template.sourceEventTitle ?? 'Deleted or none'}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Schedule Times</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>
              {template.includeScheduleTimes ? 'Included' : 'Excluded'}
            </div>
          </div>
        </div>
      </div>

      {/* Included Groups */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
        Included Groups ({groupSummaries.length})
      </h2>

      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', overflow: 'hidden', marginBottom: '20px' }}>
        {groupSummaries.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sd-muted)', fontSize: '14px' }}>
            No groups included.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Group', 'Contents'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupSummaries.map((gs, i) => {
                const colors = GROUP_BADGE_COLORS[gs.group] ?? { bg: 'var(--sd-gray-light)', color: 'var(--sd-gray)' }
                return (
                  <tr key={gs.group} style={{ borderBottom: i < groupSummaries.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: colors.bg, color: colors.color }}>
                        {gs.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px' }}>
                      {gs.summary}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit name & description */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
          Edit Template
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--sd-muted)' }}>
              Name
            </label>
            <input
              style={inputStyle}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Template name"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--sd-muted)' }}>
              Description
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Template description"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                if (!name.trim()) return
                doAction(
                  () => updateTemplate(template.id, { name: name.trim(), description: description.trim() }),
                  'Template updated.'
                )
              }}
              disabled={isPending || !name.trim()}
              style={{
                padding: '9px 18px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                background: isPending || !name.trim() ? 'var(--sd-muted)' : 'var(--sd-green)',
                color: '#fff',
                cursor: isPending || !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
