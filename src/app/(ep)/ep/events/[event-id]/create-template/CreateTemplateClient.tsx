'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createTemplateFromEvent } from '@/app/(admin)/admin/templates/actions'
import type { TemplateGroup } from '@/types/platform'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '6px',
}

interface AvailableGroups {
  ticketing: boolean
  application_form: boolean
  waiver_template: boolean
  badge_template: boolean
  schedule: boolean
  volunteering: boolean
  basic_event_rooms: boolean
}

interface Props {
  eventId: string
  eventTitle: string
  availableGroups: AvailableGroups
}

const GROUP_OPTIONS: { key: Exclude<TemplateGroup, 'core_config'>; label: string; desc: string }[] = [
  { key: 'ticketing', label: 'Ticketing', desc: 'Ticket types, groups, and merchandise' },
  { key: 'application_form', label: 'Application Form', desc: 'Application form fields and configuration' },
  { key: 'waiver_template', label: 'Waiver Template', desc: 'Waiver document template' },
  { key: 'badge_template', label: 'Badge Template', desc: 'Badge design configuration' },
  { key: 'schedule', label: 'Schedule', desc: 'Schedule activities and event timeline' },
  { key: 'volunteering', label: 'Volunteering', desc: 'Volunteer shifts and capacity configuration' },
  { key: 'basic_event_rooms', label: 'Basic Event Rooms', desc: 'Event-scoped room matrix' },
]

export default function CreateTemplateClient({ eventId, eventTitle, availableGroups }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<Set<Exclude<TemplateGroup, 'core_config'>>>(new Set())
  const [includeScheduleTimes, setIncludeScheduleTimes] = useState(false)

  function toggleGroup(key: Exclude<TemplateGroup, 'core_config'>) {
    setSelectedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('Template name is required.'); return }
    if (!description.trim()) { setError('Template description is required.'); return }

    const includedGroups: TemplateGroup[] = ['core_config', ...Array.from(selectedGroups)]

    startTransition(async () => {
      const result = await createTemplateFromEvent({
        sourceEventId: eventId,
        name: name.trim(),
        description: description.trim(),
        includedGroups,
        includeScheduleTimes,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/admin/templates`)
      }
    })
  }

  return (
    <>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← Back to Event
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Create Template from Event
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '1.5rem' }}>
        Source: <strong>{eventTitle}</strong>
      </p>

      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div>
          <label style={labelStyle}>Template Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Standard Weekend Event"
          />
        </div>

        <div>
          <label style={labelStyle}>Description *</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what this template includes and when to use it"
          />
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Included Groups</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Core config — always included */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" checked disabled style={{ accentColor: 'var(--sd-purple)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--sd-muted)', fontWeight: 500 }}>
                  Core Config <span style={{ fontSize: '11px' }}>(always included)</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                  Module configuration, workflow statuses, and cancellation policy.
                </div>
              </div>
            </div>

            {GROUP_OPTIONS.map(({ key, label, desc }) => {
              const hasData = availableGroups[key]
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: hasData ? 'pointer' : 'default',
                    opacity: hasData ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.has(key)}
                    onChange={() => toggleGroup(key)}
                    disabled={!hasData}
                    style={{ accentColor: 'var(--sd-purple)', marginTop: '2px', flexShrink: 0, cursor: hasData ? 'pointer' : 'default' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', color: hasData ? 'var(--sd-text)' : 'var(--sd-muted)', fontWeight: 500 }}>
                      {label}
                      {!hasData && <span style={{ fontSize: '11px', marginLeft: '6px' }}>(not configured)</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{desc}</div>
                    {/* Schedule times toggle — inline under the Schedule checkbox */}
                    {key === 'schedule' && selectedGroups.has('schedule') && (
                      <div style={{ marginTop: '8px', marginLeft: '0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={includeScheduleTimes}
                            onChange={e => setIncludeScheduleTimes(e.target.checked)}
                            style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '13px', color: 'var(--sd-text)' }}>Include specific dates and times</span>
                        </label>
                        <p style={{ fontSize: '12px', color: 'var(--sd-muted)', margin: '4px 0 0 24px' }}>
                          When unchecked, activities are saved without dates so they can be assigned to the new event&apos;s dates.
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Info note */}
        <div style={{
          padding: '10px 14px',
          borderRadius: '7px',
          background: 'var(--sd-blue-light)',
          border: '1px solid var(--sd-blue)',
          fontSize: '12px',
          color: 'var(--sd-blue)',
        }}>
          Venue must be selected separately after creating an event from this template.
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Link
            href={`/ep/events/${eventId}`}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: '1px solid var(--sd-border)',
              color: 'var(--sd-muted)',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: '7px',
              border: 'none',
              background: isPending ? 'var(--sd-border)' : 'var(--sd-purple)',
              color: isPending ? 'var(--sd-muted)' : '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </div>
    </>
  )
}
