'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateOrganization,
  toggleArchiveOrganization,
  addOrgMember,
  removeOrgMember,
  updateMemberAccessLevel,
} from '../actions'

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

const ACCESS_LEVELS = [
  { value: 'organization_lead', label: 'Organization Lead', color: 'var(--sd-indigo)', bg: 'var(--sd-indigo-light)' },
  { value: 'event_promoter', label: 'Event Promoter', color: 'var(--sd-purple)', bg: 'var(--sd-purple-light)' },
  { value: 'module_lead', label: 'Module Lead', color: 'var(--sd-amber-dark)', bg: 'var(--sd-amber-light)' },
  { value: 'user', label: 'Member', color: 'var(--sd-gray)', bg: 'var(--sd-gray-light)' },
] as const

type OrgData = {
  id: string
  name: string
  slug: string
  website: string | null
  paymentProvider: string | null
  archived: boolean
  tierName: string
  createdAt: string
}

type MemberRow = {
  id: string
  userId: string
  email: string
  displayName: string
  accessLevel: string
  promotedViaOrg: boolean
  createdAt: string
}

export default function OrgDetailClient({
  org,
  members,
  eventCount,
}: {
  org: OrgData
  members: MemberRow[]
  eventCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Add member form
  const [addEmail, setAddEmail] = useState('')
  const [addLevel, setAddLevel] = useState<'organization_lead' | 'event_promoter' | 'module_lead'>('event_promoter')

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

  const createdDate = new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
            {org.name}
          </h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--sd-muted)' }}>
            <span style={{ fontFamily: 'monospace' }}>{org.slug}</span>
            <span>&middot;</span>
            <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--sd-indigo-light)', color: 'var(--sd-indigo)' }}>
              {org.tierName}
            </span>
            {org.archived && (
              <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--sd-gray-light)', color: 'var(--sd-gray)' }}>
                Archived
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => doAction(
            () => toggleArchiveOrganization(org.id, !org.archived),
            org.archived ? 'Organization unarchived.' : 'Organization archived.'
          )}
          disabled={isPending}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 500,
            border: org.archived ? 'none' : '1px solid var(--sd-red-border)',
            background: org.archived ? 'var(--sd-green)' : '#fff',
            color: org.archived ? '#fff' : 'var(--sd-red)',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {org.archived ? 'Unarchive' : 'Archive'}
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
            <span style={{ color: 'var(--sd-muted)' }}>Created</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{createdDate}</div>
          </div>
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Events</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{eventCount}</div>
          </div>
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Payment Provider</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{org.paymentProvider ?? 'Not set'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Website</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>
              {org.website ? <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>{org.website}</a> : 'Not set'}
            </div>
          </div>
        </div>
      </div>

      {/* Members */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
        Members ({members.length})
      </h2>

      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', overflow: 'hidden', marginBottom: '20px' }}>
        {members.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sd-muted)', fontSize: '14px' }}>
            No members yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Name', 'Email', 'Access Level', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const levelMeta = ACCESS_LEVELS.find(l => l.value === m.accessLevel) ?? ACCESS_LEVELS[2]
                return (
                  <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sd-text)' }}>
                      {m.displayName}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px' }}>
                      {m.email}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={m.accessLevel}
                        onChange={e => doAction(
                          () => updateMemberAccessLevel(org.id, m.id, e.target.value as 'organization_lead' | 'event_promoter' | 'module_lead'),
                          `Updated ${m.displayName} to ${e.target.value.replace('_', ' ')}.`
                        )}
                        disabled={isPending}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--sd-border)',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: levelMeta.bg,
                          color: levelMeta.color,
                          cursor: 'pointer',
                        }}
                      >
                        {ACCESS_LEVELS.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${m.displayName} from this organization?`)) {
                            doAction(() => removeOrgMember(org.id, m.id), `Removed ${m.displayName}.`)
                          }
                        }}
                        disabled={isPending}
                        style={{ fontSize: '12px', color: 'var(--sd-red)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add member */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
          Add Member
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--sd-muted)' }}>
              User Email
            </label>
            <input
              style={inputStyle}
              type="email"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--sd-muted)' }}>
              Access Level
            </label>
            <select
              value={addLevel}
              onChange={e => setAddLevel(e.target.value as typeof addLevel)}
              style={{ ...inputStyle, width: 'auto' }}
            >
              {ACCESS_LEVELS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (!addEmail.trim()) return
              doAction(
                () => addOrgMember(org.id, addEmail.trim(), addLevel),
                `Added ${addEmail.trim()} as ${addLevel.replace(/_/g, ' ')}.`
              )
              setAddEmail('')
            }}
            disabled={isPending || !addEmail.trim()}
            style={{
              padding: '9px 18px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              background: isPending || !addEmail.trim() ? 'var(--sd-muted)' : 'var(--sd-green)',
              color: '#fff',
              cursor: isPending || !addEmail.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Add Member
          </button>
        </div>
      </div>
    </div>
  )
}
