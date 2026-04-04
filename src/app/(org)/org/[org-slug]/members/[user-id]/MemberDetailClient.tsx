'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMemberModuleAccess } from '../../actions'

const ALL_MODULES: { key: string; label: string }[] = [
  { key: 'application', label: 'Application' },
  { key: 'ticketing', label: 'Tickets' },
  { key: 'waiver', label: 'Waiver' },
  { key: 'venue', label: 'Venue' },
  { key: 'room_selection', label: 'Basic Event Rooms' },
  { key: 'volunteering', label: 'Volunteer' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'badge', label: 'Badge' },
]

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  organization_lead: { label: 'Organization Lead', color: 'var(--sd-indigo)', bg: 'var(--sd-indigo-light)' },
  event_promoter: { label: 'Event Promoter', color: 'var(--sd-purple)', bg: 'var(--sd-purple-light)' },
  module_lead: { label: 'Module Lead', color: 'var(--sd-amber-dark)', bg: 'var(--sd-amber-light)' },
  user: { label: 'Member', color: 'var(--sd-gray)', bg: 'var(--sd-gray-light)' },
}

export default function MemberDetailClient({
  orgSlug,
  memberId,
  accessLevel,
  grantedModules,
}: {
  orgSlug: string
  memberId: string
  accessLevel: string
  grantedModules: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selection, setSelection] = useState<string[]>([...grantedModules])

  const hasChanges =
    selection.length !== grantedModules.length ||
    selection.some(k => !grantedModules.includes(k))

  function toggleModule(moduleKey: string) {
    setSelection(prev =>
      prev.includes(moduleKey)
        ? prev.filter(k => k !== moduleKey)
        : [...prev, moduleKey]
    )
  }

  function save() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await updateMemberModuleAccess(orgSlug, memberId, selection)
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
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>
                Module Access
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: 0 }}>
                Select which modules this Module Lead can manage across all organization events. Access is filtered per event based on which modules are enabled.
              </p>
            </div>
            {hasChanges && (
              <button
                onClick={save}
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
                  flexShrink: 0,
                  marginLeft: '16px',
                }}
              >
                Save
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
            {ALL_MODULES.map(({ key, label }) => {
              const checked = selection.includes(key)
              return (
                <label
                  key={key}
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
                    onChange={() => toggleModule(key)}
                    style={{ accentColor: 'var(--sd-purple)' }}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
