'use client'

import { useState, useTransition } from 'react'
import { requestStandardRefund, submitHardshipRequest } from './refund/actions'

interface RefundButtonProps {
  eventId: string
  refundPercentage: number
  hardshipAvailable: boolean
  ticketPrice: number
  hasExistingHardshipRequest: boolean
}

export function RefundButton({
  eventId,
  refundPercentage,
  hardshipAvailable,
  ticketPrice,
  hasExistingHardshipRequest,
}: RefundButtonProps) {
  const HARDSHIP_REASONS = ['Medical', 'Work', 'Family', 'Other'] as const
  const [showConfirm, setShowConfirm] = useState(false)
  const [showHardshipForm, setShowHardshipForm] = useState(false)
  const [reason, setReason] = useState('')
  const [supportingDetails, setSupportingDetails] = useState('')
  const isOtherReason = reason === 'Other'
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const refundAmount = ((ticketPrice * refundPercentage) / 100).toFixed(2)

  function handleRefundClick() {
    setError('')
    setShowConfirm(true)
  }

  function handleConfirmRefund() {
    setError('')
    startTransition(async () => {
      const result = await requestStandardRefund(eventId)
      if ('error' in result) {
        setError(result.error)
        setShowConfirm(false)
      } else {
        setSuccess('Refund processed successfully.')
        setShowConfirm(false)
      }
    })
  }

  function handleHardshipClick() {
    setError('')
    setShowHardshipForm(true)
  }

  function handleHardshipSubmit() {
    if (!reason) {
      setError('Please select a reason for your hardship cancellation request.')
      return
    }
    if (reason === 'Other' && !supportingDetails.trim()) {
      setError('Please provide supporting details when selecting "Other".')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await submitHardshipRequest(eventId, reason, supportingDetails)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess('Your hardship request has been submitted. You will be notified when it is reviewed.')
        setShowHardshipForm(false)
      }
    })
  }

  // Success state — replace the button entirely
  if (success) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--sd-green-dark)', marginTop: '8px' }}>
        {success}
      </p>
    )
  }

  if (refundPercentage > 0) {
    return (
      <div style={{ marginTop: '8px' }}>
        {!showConfirm ? (
          <button
            onClick={handleRefundClick}
            disabled={isPending}
            style={{
              background: 'var(--sd-red)',
              color: '#fff',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Request Refund ({refundPercentage}%)
          </button>
        ) : (
          <div
            style={{
              background: 'var(--sd-red-light)',
              border: '1px solid var(--sd-red-border)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--sd-text)', marginBottom: '10px' }}>
              You will receive a {refundPercentage}% refund of ${refundAmount}. This action cannot be undone.
            </p>
            {error && (
              <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginBottom: '8px' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleConfirmRefund}
                disabled={isPending}
                style={{
                  background: 'var(--sd-red)',
                  color: '#fff',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Processing…' : 'Confirm Refund'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setError('') }}
                disabled={isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: 'var(--sd-muted)',
                  cursor: 'pointer',
                  padding: '7px 0',
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

  if (hasExistingHardshipRequest) {
    return (
      <div style={{ marginTop: '8px' }}>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: '99px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'var(--sd-amber-light)',
            color: 'var(--sd-amber-dark)',
          }}
        >
          Hardship Request Pending
        </span>
      </div>
    )
  }

  if (hardshipAvailable) {
    return (
      <div style={{ marginTop: '8px' }}>
        {!showHardshipForm ? (
          <button
            onClick={handleHardshipClick}
            disabled={isPending}
            style={{
              background: 'var(--sd-amber-dark)',
              color: '#fff',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Request Hardship Cancellation
          </button>
        ) : (
          <div
            style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--sd-text)', marginBottom: '10px' }}>
              Describe the circumstances for your cancellation request. The event promoter will review and respond.
            </p>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-text)', display: 'block', marginBottom: '4px' }}>
                Reason <span style={{ color: 'var(--sd-red)' }}>*</span>
              </label>
              <select
                value={reason}
                onChange={e => { setReason(e.target.value); setError('') }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--sd-border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: '#fff',
                  color: reason ? 'var(--sd-text)' : 'var(--sd-muted)',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>Select a reason...</option>
                {HARDSHIP_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-text)', display: 'block', marginBottom: '4px' }}>
                Supporting Details {isOtherReason
                  ? <span style={{ color: 'var(--sd-red)' }}>*</span>
                  : <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--sd-muted)' }}>(optional)</span>}
              </label>
              <textarea
                value={supportingDetails}
                onChange={e => setSupportingDetails(e.target.value)}
                placeholder={isOtherReason ? 'Please describe the circumstances...' : 'Any additional context (optional)...'}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${isOtherReason && !supportingDetails.trim() ? 'var(--sd-red)' : 'var(--sd-border)'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  minHeight: '80px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {error && (
              <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginBottom: '8px' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleHardshipSubmit}
                disabled={isPending}
                style={{
                  background: 'var(--sd-amber-dark)',
                  color: '#fff',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Submitting…' : 'Submit Request'}
              </button>
              <button
                onClick={() => { setShowHardshipForm(false); setError(''); setReason(''); setSupportingDetails(''); }}
                disabled={isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: 'var(--sd-muted)',
                  cursor: 'pointer',
                  padding: '7px 0',
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

  return null
}
