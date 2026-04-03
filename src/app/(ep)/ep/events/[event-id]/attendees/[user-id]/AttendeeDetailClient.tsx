'use client'

import { useState, useTransition } from 'react'
import { updateApplicationStatus } from './actions'

const APPLICATION_STATUSES = [
  'Incomplete',
  'In Progress',
  'Needs Review',
  'Completed',
  'Approved',
  'Declined',
  'Closed',
]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Incomplete':    { bg: '#F3F4F6', color: '#6B7280' },
  'In Progress':   { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Needs Review':  { bg: 'var(--sd-amber-light)', color: '#92400e' },
  'Completed':     { bg: 'var(--sd-blue-light)', color: '#1e40af' },
  'Approved':      { bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  'Declined':      { bg: 'var(--sd-red-light)', color: '#991b1b' },
  'Closed':        { bg: '#F3F4F6', color: '#9CA3AF' },
}

interface Props {
  eventId: string
  targetUserId: string
  applicationStatus: string
  ticketStatus: string
  waiverStatus: string
  badgeStatus: string
  lockStatus: string
  roomStatus: string
}

export default function AttendeeDetailClient({
  eventId,
  targetUserId,
  applicationStatus,
  ticketStatus,
  waiverStatus,
  badgeStatus,
  lockStatus,
  roomStatus,
}: Props) {
  const [currentAppStatus, setCurrentAppStatus] = useState(applicationStatus)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [epNote, setEpNote] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const appBadge = STATUS_COLORS[currentAppStatus] ?? STATUS_COLORS['Incomplete']

  function handleStatusChange(newStatus: string) {
    if (newStatus === currentAppStatus) return
    setPendingStatus(newStatus)

    // Show modal if reverting from Approved and ticket is complete
    if (currentAppStatus === 'Approved' && newStatus !== 'Approved' && ticketStatus === 'Complete') {
      setShowModal(true)
      return
    }

    applyStatus(newStatus)
  }

  function applyStatus(newStatus: string, action?: 'revoke_and_refund' | 'block_only', note?: string) {
    setError('')
    startTransition(async () => {
      const result = await updateApplicationStatus(eventId, targetUserId, newStatus, action, note)
      if (result.error) {
        setError(result.error)
        setPendingStatus(null)
      } else if (result.success) {
        setCurrentAppStatus(newStatus)
        setPendingStatus(null)
        setShowModal(false)
        setEpNote('')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Application status card */}
      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '20px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
          Application Status
        </div>
        <span style={{
          display: 'inline-block',
          fontSize: '12px',
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: '99px',
          background: appBadge.bg,
          color: appBadge.color,
          marginBottom: '12px',
        }}>
          {currentAppStatus}
        </span>

        <select
          value={pendingStatus ?? currentAppStatus}
          onChange={e => handleStatusChange(e.target.value)}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '7px',
            border: '1px solid var(--sd-border)',
            fontSize: '13px',
            color: 'var(--sd-text)',
            background: '#fff',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {APPLICATION_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '8px' }}>{error}</p>
        )}
      </div>

      {/* Other statuses (read-only) */}
      {[
        { label: 'Ticket', value: ticketStatus },
        { label: 'Waiver', value: waiverStatus },
        { label: 'Badge', value: badgeStatus },
        { label: 'Lock', value: lockStatus },
        { label: 'Room', value: roomStatus },
      ].map(item => (
        <div key={item.label} style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {item.label}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--sd-text)', fontWeight: 500 }}>
            {item.value}
          </span>
        </div>
      ))}

      {/* Reverted-approval modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 'var(--sd-radius)',
            padding: '28px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '8px' }}>
              Attendee has a completed ticket
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              This attendee&apos;s application status is being changed from <strong>Approved</strong> to <strong>{pendingStatus}</strong>. They have a completed ticket purchase. Choose how to proceed:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div>
                <button
                  disabled={true}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '7px',
                    border: '1px solid var(--sd-border)',
                    background: '#F3F4F6',
                    color: '#9CA3AF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'not-allowed',
                    textAlign: 'left',
                    opacity: 0.6,
                  }}
                >
                  Cancel ticket and initiate refund (per Cancellation Policy)
                </button>
                <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: 0 }}>
                  Refund processing requires payment integration (not yet configured).
                </p>
              </div>

              <div>
                <button
                  onClick={() => {
                    if (!epNote.trim()) {
                      setError('An internal note is required when blocking access only.')
                      return
                    }
                    applyStatus(pendingStatus!, 'block_only', epNote)
                  }}
                  disabled={isPending}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '7px',
                    border: '1px solid var(--sd-border)',
                    background: 'var(--sd-card)',
                    color: 'var(--sd-text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    marginBottom: '8px',
                  }}
                >
                  Block portal access only (preserve ticket)
                </button>
                <textarea
                  placeholder="Internal note (required)"
                  value={epNote}
                  onChange={e => { setEpNote(e.target.value); setError('') }}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--sd-border)',
                    borderRadius: '7px',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginBottom: '12px' }}>{error}</p>
            )}

            <button
              onClick={() => { setShowModal(false); setPendingStatus(null); setError(''); setEpNote('') }}
              disabled={isPending}
              style={{
                padding: '8px 16px',
                borderRadius: '7px',
                border: '1px solid var(--sd-border)',
                background: 'none',
                color: 'var(--sd-muted)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
