'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { inviteOrgMember, changeOrgMemberLevel, removeOrgMemberByOl } from '../actions'
import type { OrgAccessLevel } from '@/types/platform'

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

const LEVELS: { value: OrgAccessLevel; label: string; color: string; bg: string }[] = [
  { value: 'organization_lead', label: 'Organization Lead', color: 'var(--sd-indigo)', bg: 'var(--sd-indigo-light)' },
  { value: 'event_promoter', label: 'Event Promoter', color: 'var(--sd-purple)', bg: 'var(--sd-purple-light)' },
  { value: 'module_lead', label: 'Module Lead', color: 'var(--sd-amber-dark)', bg: 'var(--sd-amber-light)' },
  { value: 'user', label: 'Member', color: 'var(--sd-gray)', bg: 'var(--sd-gray-light)' },
]

type MemberRow = {
  id: string
  userId: string
  email: string
  displayName: string
  accessLevel: string
  createdAt: string
}

type PendingInvitation = {
  id: string
  email: string
  accessLevel: string
  createdAt: string
}

export default function MembersClient({
  orgSlug,
  callerLevel,
  members,
  pendingInvitations,
}: {
  orgSlug: string
  callerLevel: string
  members: MemberRow[]
  pendingInvitations: PendingInvitation[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Invite form
  const [invEmail, setInvEmail] = useState('')
  const [invLevel, setInvLevel] = useState<'event_promoter' | 'module_lead'>('event_promoter')

  const isOl = callerLevel === 'organization_lead'

  function doAction(fn: () => Promise<{ success: true; method?: string } | { error: string }>, successMsg?: string) {
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) setError(result.error)
      else {
        setSuccess(successMsg || 'Done.')
        router.refresh()
      }
    })
  }

  function handleInvite() {
    if (!invEmail.trim()) return
    doAction(
      () => inviteOrgMember(orgSlug, invEmail.trim(), invLevel),
      `Invitation sent to ${invEmail.trim()}.`
    )
    setInvEmail('')
  }

  // OLs can change any level; EPs can only set module_lead
  const allowedLevels = isOl
    ? LEVELS
    : LEVELS.filter(l => l.value === 'module_lead')

  return (
    <div>
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

      {/* Member list */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', overflow: 'hidden', marginBottom: '20px' }}>
        {members.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sd-muted)', fontSize: '14px' }}>No members.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Name', 'Email', 'Access Level', '', ...(isOl ? [''] : [])].map((h, idx) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const meta = LEVELS.find(l => l.value === m.accessLevel) ?? LEVELS[3]
                // EPs can only edit members with module_lead or user level
                const memberIsHighLevel = m.accessLevel === 'organization_lead' || m.accessLevel === 'event_promoter'
                const canEditThisMember = isOl || (callerLevel === 'event_promoter' && !memberIsHighLevel)
                // EPs can only assign module_lead or user; OLs can assign anything
                const editableLevels = isOl ? LEVELS : LEVELS.filter(l => l.value === 'module_lead' || l.value === 'user')

                return (
                  <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sd-text)' }}>{m.displayName}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--sd-muted)', fontSize: '13px' }}>{m.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {canEditThisMember ? (
                        <select
                          value={m.accessLevel}
                          onChange={e => doAction(
                            () => changeOrgMemberLevel(orgSlug, m.id, e.target.value as OrgAccessLevel),
                            `Updated ${m.displayName}.`
                          )}
                          disabled={isPending}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--sd-border)',
                            fontSize: '12px', fontWeight: 600, background: meta.bg, color: meta.color, cursor: 'pointer',
                          }}
                        >
                          {editableLevels.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link
                        href={`/org/${orgSlug}/members/${m.userId}`}
                        style={{ fontSize: '12px', color: 'var(--sd-purple)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Manage &rarr;
                      </Link>
                    </td>
                    {isOl && (
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${m.displayName} from this organization?`)) {
                              doAction(() => removeOrgMemberByOl(orgSlug, m.id), `Removed ${m.displayName}.`)
                            }
                          }}
                          disabled={isPending}
                          style={{ fontSize: '12px', color: 'var(--sd-red)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '8px' }}>
            Pending Invitations
          </h2>
          <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '12px 16px' }}>
            {pendingInvitations.map(inv => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--sd-border-light)', fontSize: '13px' }}>
                <span style={{ color: 'var(--sd-text)' }}>{inv.email}</span>
                <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--sd-amber-light)', color: 'var(--sd-amber-dark)' }}>
                  {inv.accessLevel.replace(/_/g, ' ')} &middot; pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form — OL only */}
      {isOl && (
        <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Invite Member
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '12px', marginTop: 0 }}>
            Enter an email address. If the user already has an account, they will be added immediately. Otherwise, a registration invitation will be sent.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                style={inputStyle}
                type="email"
                value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <select
              value={invLevel}
              onChange={e => setInvLevel(e.target.value as typeof invLevel)}
              style={{ ...inputStyle, width: 'auto' }}
            >
              <option value="event_promoter">Event Promoter</option>
              <option value="module_lead">Module Lead</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={isPending || !invEmail.trim()}
              style={{
                padding: '9px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, border: 'none',
                background: isPending || !invEmail.trim() ? 'var(--sd-muted)' : 'var(--sd-green)', color: '#fff',
                cursor: isPending || !invEmail.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Invite
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
