'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkflowStatus } from '@/types/platform'
import { updateModuleConfig } from './actions'
import type { ModuleCfg } from './actions'

// Modules that are never "required" — they have no completion gate
const NEVER_REQUIRED = new Set(['schedule', 'venue', 'room_selection'])

// Canonical module order matching the attendee workflow progression.
// venue and room_selection are mutually exclusive — only one may be enabled at a time.
const MODULE_ORDER = ['application', 'ticketing', 'waiver', 'venue', 'room_selection', 'volunteering', 'schedule', 'badge']

const MODULE_META: Record<string, { label: string; description: string; lockEnabled?: boolean; mutex?: string }> = {
  application:    { label: 'Application',     description: 'Custom application form attendees complete before being approved.' },
  ticketing:      { label: 'Ticketing',        description: 'Ticket types, pricing, and purchase flow. Required for all events.', lockEnabled: true },
  waiver:         { label: 'Waiver',           description: 'Digital waiver signing via Odoo integration.' },
  venue:          { label: 'Venue',            description: 'A reusable location object with optional contact details and Room Matrix. Assign a venue from this event\'s Venue page. Mutually exclusive with Basic Event Rooms.', mutex: 'room_selection' },
  room_selection: { label: 'Basic Event Rooms', description: 'An event-specific Room Matrix tied to this event only — not reusable across events. Mutually exclusive with Venue.', mutex: 'venue' },
  volunteering:   { label: 'Volunteering',     description: 'Volunteer shift signup and required-hours tracking.' },
  schedule:       { label: 'Schedule',         description: 'Public event schedule and activity listings.' },
  badge:          { label: 'Badge',            description: 'Badge creation using the Badge Maker module.' },
}

type FormCfg = {
  enabled: boolean
  required: boolean
  opens_at_status: string   // '' = null
  closes_at_status: string  // '' = null
  room_selection_workflow: boolean
  custom_status_message_enabled: boolean
  custom_status_message: string
}

type RawModuleCfg = {
  enabled?: boolean
  required?: boolean
  opens_at_status?: string | null
  closes_at_status?: string | null
  room_selection_workflow?: boolean
  custom_status_message_enabled?: boolean
  custom_status_message?: string
}

function buildInitialState(moduleConfig: Record<string, RawModuleCfg>): Record<string, FormCfg> {
  const result: Record<string, FormCfg> = {}
  for (const key of MODULE_ORDER) {
    const cfg = moduleConfig[key] ?? {}
    result[key] = {
      enabled:                       key === 'ticketing' ? true  : (cfg.enabled  ?? false),
      required:                      NEVER_REQUIRED.has(key) ? false : (key === 'ticketing' ? true : (cfg.required ?? false)),
      opens_at_status:               cfg.opens_at_status  ?? '',
      closes_at_status:              cfg.closes_at_status ?? '',
      room_selection_workflow:       cfg.room_selection_workflow ?? false,
      custom_status_message_enabled: cfg.custom_status_message_enabled ?? false,
      custom_status_message:         cfg.custom_status_message ?? '',
    }
  }
  return result
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--sd-border)',
  borderRadius: '6px',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  width: '100%',
}

// Status dropdown restricted to 'Published' + custom statuses only
function StatusSelect({
  value,
  onChange,
  includeNull,
  nullLabel,
  disabled,
  sortedStatuses,
}: {
  value: string
  onChange: (v: string) => void
  includeNull: boolean
  nullLabel: string
  disabled: boolean
  sortedStatuses: WorkflowStatus[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={selectStyle}>
      {includeNull
        ? <option value="">{nullLabel}</option>
        : <option value="">— not set —</option>
      }
      <optgroup label="System Statuses">
        <option value="Published">Published</option>
      </optgroup>
      {sortedStatuses.length > 0 && (
        <optgroup label="Custom Statuses">
          {sortedStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      )}
    </select>
  )
}

export default function ModuleConfigClient({
  eventId,
  moduleConfig,
  workflowStatuses,
}: {
  eventId: string
  moduleConfig: Record<string, RawModuleCfg>
  workflowStatuses: WorkflowStatus[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [config, setConfig] = useState<Record<string, FormCfg>>(buildInitialState(moduleConfig))
  const [error, setError] = useState('')

  const sorted = [...workflowStatuses].sort((a, b) => a.order - b.order)

  function update(key: string, field: keyof FormCfg, value: string | boolean) {
    setConfig(prev => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } }
      // Enforce mutex: enabling venue disables room_selection and vice versa
      const meta = MODULE_META[key]
      if (field === 'enabled' && value === true && meta?.mutex) {
        next[meta.mutex] = { ...next[meta.mutex], enabled: false }
      }
      return next
    })
  }

  function handleSave() {
    setError('')
    const outConfig: Record<string, ModuleCfg> = {}
    for (const key of MODULE_ORDER) {
      const cfg = config[key]
      if (!cfg.enabled) continue
      const isRoomModule = key === 'venue' || key === 'room_selection'
      outConfig[key] = {
        enabled:                       true,
        required:                      NEVER_REQUIRED.has(key) ? false : cfg.required,
        opens_at_status:               cfg.opens_at_status  || null,
        closes_at_status:              cfg.closes_at_status || null,
        room_selection_workflow:       isRoomModule ? cfg.room_selection_workflow : undefined,
        custom_status_message_enabled: cfg.custom_status_message_enabled,
        custom_status_message:         cfg.custom_status_message_enabled ? cfg.custom_status_message : '',
      }
    }
    startTransition(async () => {
      const result = await updateModuleConfig(eventId, outConfig)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/ep/events/${eventId}`)
      }
    })
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--sd-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '5px',
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {MODULE_ORDER.map(key => {
          const meta = MODULE_META[key]
          const cfg = config[key]
          const locked = !!meta.lockEnabled
          const neverRequired = NEVER_REQUIRED.has(key)
          const isRoomModule = key === 'venue' || key === 'room_selection'

          return (
            <div
              key={key}
              style={{
                background: 'var(--sd-card)',
                border: '1px solid var(--sd-border)',
                borderRadius: 'var(--sd-radius)',
                overflow: 'hidden',
                opacity: cfg.enabled ? 1 : 0.55,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: locked ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    disabled={locked || isPending}
                    onChange={e => update(key, 'enabled', e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: locked ? 'not-allowed' : 'pointer' }}
                  />
                </label>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>{meta.label}</span>
                    {locked && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#E0E7FF', color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Always On
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{meta.description}</div>
                </div>
              </div>

              {/* Expanded configuration — only when enabled */}
              {cfg.enabled && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Opens at */}
                    <div>
                      <label style={labelStyle}>Opens at status</label>
                      <StatusSelect
                        value={cfg.opens_at_status}
                        onChange={v => update(key, 'opens_at_status', v)}
                        includeNull={false}
                        nullLabel=""
                        disabled={isPending}
                        sortedStatuses={sorted}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px' }}>
                        Module opens automatically when the event reaches this status.
                      </div>
                    </div>

                    {/* Closes at */}
                    <div>
                      <label style={labelStyle}>Closes at status</label>
                      <StatusSelect
                        value={cfg.closes_at_status}
                        onChange={v => update(key, 'closes_at_status', v)}
                        includeNull={true}
                        nullLabel="Open until Event Locked"
                        disabled={isPending}
                        sortedStatuses={sorted}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px' }}>
                        Module becomes read-only at this status. Leave unset to stay open until Event Locked.
                      </div>
                    </div>

                    {/* Required toggle — not shown for NEVER_REQUIRED modules */}
                    {!locked && !neverRequired && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '13px', color: 'var(--sd-text)' }}>
                          <input
                            type="checkbox"
                            checked={cfg.required}
                            disabled={isPending}
                            onChange={e => update(key, 'required', e.target.checked)}
                            style={{ width: '14px', height: '14px' }}
                          />
                          Required — attendees must complete this module to reach &ldquo;Ready to Lock&rdquo;
                        </label>
                      </div>
                    )}

                    {/* Room Selection Workflow toggle — venue and room_selection only */}
                    {isRoomModule && (
                      <div style={{ gridColumn: '1 / -1', paddingTop: '4px', borderTop: '1px solid var(--sd-border)', marginTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '13px', color: 'var(--sd-text)' }}>
                          <input
                            type="checkbox"
                            checked={cfg.room_selection_workflow}
                            disabled={isPending}
                            onChange={e => update(key, 'room_selection_workflow', e.target.checked)}
                            style={{ width: '14px', height: '14px', marginTop: '2px', flexShrink: 0 }}
                          />
                          <span>
                            <strong>Enable Room Selection Workflow</strong>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                              Enables room selection in checkout, Roommate Finder, room blocking, reservations, and roommate codes.
                            </span>
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Custom status message */}
                    <div style={{ gridColumn: '1 / -1', paddingTop: '4px', borderTop: isRoomModule ? 'none' : '1px solid var(--sd-border)', marginTop: isRoomModule ? '0' : '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '13px', color: 'var(--sd-text)', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={cfg.custom_status_message_enabled}
                          disabled={isPending}
                          onChange={e => update(key, 'custom_status_message_enabled', e.target.checked)}
                          style={{ width: '14px', height: '14px' }}
                        />
                        Add custom status message for this module&rsquo;s opening
                        <span style={{ fontSize: '11px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>
                          &nbsp;— available as {'{status_message}'} in the Event Status Transition notification
                        </span>
                      </label>
                      {cfg.custom_status_message_enabled && (
                        <textarea
                          value={cfg.custom_status_message}
                          onChange={e => update(key, 'custom_status_message', e.target.value)}
                          disabled={isPending}
                          placeholder={`Custom message shown when ${meta.label} opens…`}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            border: '1px solid var(--sd-border)',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: 'var(--sd-text)',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--sd-red-light)', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: '8px 22px',
            borderRadius: '6px',
            border: 'none',
            background: isPending ? '#E5E7EB' : 'var(--sd-purple)',
            color: isPending ? 'var(--sd-muted)' : '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
        <a
          href={`/ep/events/${eventId}`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid var(--sd-border)',
            color: 'var(--sd-text)',
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Cancel
        </a>
      </div>
    </div>
  )
}
