'use client'

import { useState, useTransition } from 'react'
import { updateUserRole, adminUpdatePaymentProvider } from './actions'

type User = {
  id: string
  email: string
  preferred_scene_name: string | null
  role: string
  payment_provider: string | null
  telegram_handle: string | null
  telegram_verified: boolean
  date_of_birth: string
  created_at: string
  phone: string | null
  address: string | null
  zip_code: string | null
}

const roleBadge = (role: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    system_admin: { label: 'System Admin', bg: '#EDE9FE', color: '#5B21B6' },
    event_promoter: { label: 'Event Promoter', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
    user: { label: 'User', bg: 'var(--sd-card2)', color: 'var(--sd-muted)' },
  }
  return map[role] ?? map.user
}

const cardStyle: React.CSSProperties = {
  background: 'var(--sd-card)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  padding: '24px',
  marginBottom: '16px',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  marginBottom: '16px',
  paddingBottom: '10px',
  borderBottom: '1px solid var(--sd-border-light)',
}

export default function UserDetailClient({
  targetUser,
  currentUserId,
}: {
  targetUser: User
  currentUserId: string
}) {
  const isSelf = targetUser.id === currentUserId
  const isEpOrAdmin = targetUser.role === 'event_promoter' || targetUser.role === 'system_admin'
  const badge = roleBadge(targetUser.role)

  // Role management
  const [roleError, setRoleError] = useState('')
  const [roleSuccess, setRoleSuccess] = useState('')
  const [isRolePending, startRoleTransition] = useTransition()

  // Payment provider
  const [paymentProvider, setPaymentProvider] = useState<'square' | 'paypal'>(
    (targetUser.payment_provider as 'square' | 'paypal') ?? 'square'
  )
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')
  const [isPaymentPending, startPaymentTransition] = useTransition()

  function handleRoleChange(newRole: 'user' | 'event_promoter') {
    const label = newRole === 'event_promoter' ? 'Event Promoter' : 'User'
    if (!window.confirm(`Change this user's role to ${label}?`)) return
    setRoleError('')
    setRoleSuccess('')
    startRoleTransition(async () => {
      const result = await updateUserRole(targetUser.id, newRole)
      if (result.error) {
        setRoleError(result.error)
      } else {
        setRoleSuccess(`Role updated to ${label}.`)
      }
    })
  }

  function handlePaymentSave() {
    setPaymentError('')
    setPaymentSuccess('')
    startPaymentTransition(async () => {
      const result = await adminUpdatePaymentProvider(targetUser.id, paymentProvider)
      if (result.error) {
        setPaymentError(result.error)
      } else {
        setPaymentSuccess('Payment provider updated.')
      }
    })
  }

  const joined = new Date(targetUser.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const dob = new Date(targetUser.date_of_birth).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const displayName = targetUser.preferred_scene_name || targetUser.email.split('@')[0]

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '7px 0',
    borderBottom: '1px solid var(--sd-border-light)',
  }

  return (
    <div>
      {/* Profile */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>Profile</div>
        {[
          { key: 'Display name', val: displayName },
          { key: 'Email', val: targetUser.email },
          { key: 'Date of birth', val: dob },
          { key: 'Phone', val: targetUser.phone || '—' },
          { key: 'Address', val: targetUser.address || '—' },
          { key: 'Zip code', val: targetUser.zip_code || '—' },
          { key: 'Telegram', val: targetUser.telegram_handle ? `@${targetUser.telegram_handle}` : '—' },
          {
            key: 'Telegram verified',
            val: targetUser.telegram_verified ? '✓ Yes' : 'No',
          },
          { key: 'Member since', val: joined },
        ].map(({ key, val }) => (
          <div key={key} style={rowStyle}>
            <span style={{ color: 'var(--sd-muted)' }}>{key}</span>
            <span style={{ fontWeight: 500 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Role Management */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>Role Management</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>Current role:</span>
          <span
            style={{
              padding: '2px 10px',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: 500,
              background: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
        </div>

        {isSelf ? (
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>
            You cannot modify your own role.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {targetUser.role !== 'event_promoter' && (
              <button
                onClick={() => handleRoleChange('event_promoter')}
                disabled={isRolePending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isRolePending ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background: isRolePending ? 'var(--sd-muted)' : 'var(--sd-green)',
                  color: '#fff',
                }}
              >
                {isRolePending ? 'Saving…' : 'Promote to Event Promoter'}
              </button>
            )}
            {targetUser.role === 'event_promoter' && (
              <button
                onClick={() => handleRoleChange('user')}
                disabled={isRolePending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isRolePending ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--sd-border)',
                  background: '#fff',
                  color: 'var(--sd-text)',
                }}
              >
                {isRolePending ? 'Saving…' : 'Demote to User'}
              </button>
            )}
          </div>
        )}

        {roleSuccess && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '7px',
              fontSize: '13px',
              border: '1px solid #6EE7B7',
              background: 'var(--sd-green-light)',
              color: 'var(--sd-green-dark)',
            }}
          >
            ✓ {roleSuccess}
          </div>
        )}
        {roleError && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '7px',
              fontSize: '13px',
              border: '1px solid #FCA5A5',
              background: 'var(--sd-red-light)',
              color: '#991b1b',
            }}
          >
            {roleError}
          </div>
        )}
      </div>

      {/* Payment Provider — EP/admin only */}
      {isEpOrAdmin && (
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Payment Provider</div>
          {(['square', 'paypal'] as const).map(p => (
            <label
              key={p}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <input
                type="radio"
                name="admin_payment_provider"
                value={p}
                checked={paymentProvider === p}
                onChange={() => setPaymentProvider(p)}
                style={{ accentColor: 'var(--sd-green)', width: '16px', height: '16px' }}
              />
              {p === 'square' ? 'Square' : 'PayPal'}
            </label>
          ))}

          {paymentSuccess && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                fontSize: '13px',
                border: '1px solid #6EE7B7',
                background: 'var(--sd-green-light)',
                color: 'var(--sd-green-dark)',
                marginBottom: '10px',
              }}
            >
              ✓ {paymentSuccess}
            </div>
          )}
          {paymentError && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                fontSize: '13px',
                border: '1px solid #FCA5A5',
                background: 'var(--sd-red-light)',
                color: '#991b1b',
                marginBottom: '10px',
              }}
            >
              {paymentError}
            </div>
          )}

          <button
            onClick={handlePaymentSave}
            disabled={isPaymentPending}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isPaymentPending ? 'not-allowed' : 'pointer',
              border: 'none',
              background: isPaymentPending ? 'var(--sd-muted)' : 'var(--sd-green)',
              color: '#fff',
            }}
          >
            {isPaymentPending ? 'Saving…' : 'Save Payment Provider'}
          </button>
        </div>
      )}
    </div>
  )
}
