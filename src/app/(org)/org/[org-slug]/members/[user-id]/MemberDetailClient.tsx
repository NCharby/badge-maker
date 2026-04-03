'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMemberModuleAccess } from '../../actions'

const MODULE_LABELS: Record<string, string> = {
  application: 'Application',
  ticketing: 'Tickets',
  waiver: 'Waiver',
  venue: 'Venue',
  room_selection: 'Basic Event Rooms',
  volunteering: 'Volunteer',
  schedule: 'Schedule',
  badge: 'Badge',
}

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  organization_lead: { label: 'Organization Lead', color: 'var(--sd-indigo)', bg: 'var(--sd-indigo-light)' },
  event_promoter: { label: 'Event Promoter', color: 'var(--sd-purple)', bg: 'var(--sd-purple-light)' },
  module_lead: { label: 'Module Lead', color: 'var(--sd-amber-dark)', bg: 'var(--sd-amber-light)' },
  user: { label: 'Member', color: 'var(--sd-gray)', bg: 'var(--sd-gray-light)' },
}

type EventRow = {
  id: string
  title: string
  status: string
  enabledModules: string[]
  grantedModules: string[]
}

export default function MemberDetailClient({
  orgSlug,
  memberId,
  accessLevel,
  events,
}: {
  orgSlug: string
  memberId: string
  accessLevel: string
  events: EventRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Local state for checkbox selections, keyed by event ID
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    for (const event of events) {
      initial[event.id] = [...event.grantedModules]
    }
    return initial
  })

  // Track which events have unsaved changes
  function hasChanges(eventId: string, original: string[]): boolean {
    const current = selections[eventId] ?? []
    if (current.length !== original.length) return true
    return current.some(k => !original.includes(k)) || original.some(k => !current.includes(k))
  }

  function toggleModule(eventId: string, moduleKey: string) {
    setSelections(prev => {
      const current = prev[eventId] ?? []
      const next = current.includes(moduleKey)
        ? current.filter(k => k !== moduleKey)
        : [...current, moduleKey]
      return { ...prev, [eventId]: next }
    })
  }

  function saveEvent(eventId: string) {
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await updateMemberModuleAccess(orgSlug, memberId, eventId, selections[eventId] ?? [])
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess('Module access updated.')
        router.refresh()
      }
    })
  }

  const meta = LEVEL_META[accessLevel] ?? LEVEL_META.user
  const isModuleLead = accessLevel === 'module_lead'

  // Only show events that have at least one enabled module
  const eventsWithModules = events.filter(e => e.enabledModules.length > 0)

  return (
    <div>
      {/* Access level badge */}
      <div style={{ marginBottom: '24px' }}>
        <span style={{
          padding: '4px 12px',
          borderRadius: '99px',
          fontSize: '12px',
          fontWeight: 600,
          background: meta.bg,
          color: meta.color,
        }}>
          {meta.label}
        </span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-red-border)', background: 'var(--sd-red-light)', color: 'var(--sd-red-dark)', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid var(--sd-green-border)', background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)', marginBottom: '16px' }}>
          {success}
        </div>
      )}

      {!isModuleLead ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '20px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--sd-muted)', margin: 0 }}>
            Module access configuration is only available for members with the Module Lead access level.
            {accessLevel === 'organization_lead' || accessLevel === 'event_promoter'
              ? ' This member already has full access to all event modules.'
              : ' Change this member\'s access level to Module Lead to configure per-module access.'}
          </p>
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Module Access by Event
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '16px', marginTop: 0 }}>
            Select which modules this Module Lead can manage for each event. Only modules enabled on the event are shown.
          </p>

          {eventsWithModules.length === 0 ? (
            <div style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--sd-muted)',
              fontSize: '14px',
            }}>
              No events with enabled modules in this organization.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {eventsWithModules.map(event => {
                const changed = hasChanges(event.id, event.grantedModules)
                const currentSelection = selections[event.id] ?? []

                return (
                  <div
                    key={event.id}
                    style={{
                      background: 'var(--sd-card)',
                      border: '1px solid var(--sd-border)',
                      borderRadius: 'var(--sd-radius)',
                      padding: '16px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                          {event.status}
                        </div>
                      </div>
                      {changed && (
                        <button
                          onClick={() => saveEvent(event.id)}
                          disabled={isPending}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: 'none',
                            background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)',
                            color: '#fff',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Save
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {event.enabledModules.map(moduleKey => {
                        const checked = currentSelection.includes(moduleKey)
                        return (
                          <label
                            key={moduleKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              border: `1px solid ${checked ? 'var(--sd-purple)' : 'var(--sd-border)'}`,
                              background: checked ? 'var(--sd-purple-light)' : 'transparent',
                              color: checked ? 'var(--sd-purple)' : 'var(--sd-text)',
                              fontWeight: checked ? 600 : 400,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModule(event.id, moduleKey)}
                              style={{ accentColor: 'var(--sd-purple)' }}
                            />
                            {MODULE_LABELS[moduleKey] ?? moduleKey}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
