'use client'

import { useState, useTransition } from 'react'
import { SignatureCapture } from '@/components/molecules/SignatureCapture'
import { submitWaiver } from './actions'

interface PlatformWaiverClientProps {
  eventId: string
  eventTitle: string
  waiverContent: string
  user: {
    firstName: string
    lastName: string
    email: string
    dateOfBirth: string
  }
}

export default function PlatformWaiverClient({
  eventId,
  eventTitle,
  waiverContent,
  user,
}: PlatformWaiverClientProps) {
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  const isFormValid = agreed && !!signature

  function handleSubmit() {
    if (!isFormValid) return
    setError(null)

    startTransition(async () => {
      const result = await submitWaiver(eventId, {
        signatureImage: signature!,
      })

      if ('error' in result) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  // ---- Success state ----
  if (submitted) {
    return (
      <div
        style={{
          background: 'var(--sd-green-light)',
          border: '1px solid var(--sd-green)',
          borderRadius: 'var(--sd-radius)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--sd-green-dark)',
            marginBottom: '8px',
          }}
        >
          Waiver Signed Successfully
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
          Your waiver for <strong>{eventTitle}</strong> has been recorded.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          A signed PDF copy has been generated and stored for your records.
        </p>
      </div>
    )
  }

  // ---- Form ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Read-only user info */}
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '1.25rem',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--sd-text)',
            marginBottom: '12px',
          }}
        >
          Your Information
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '13px',
          }}
        >
          <div>
            <div style={{ color: 'var(--sd-muted)', marginBottom: '2px' }}>Name</div>
            <div style={{ color: 'var(--sd-text)', fontWeight: 500 }}>{fullName}</div>
          </div>
          <div>
            <div style={{ color: 'var(--sd-muted)', marginBottom: '2px' }}>Email</div>
            <div style={{ color: 'var(--sd-text)', fontWeight: 500 }}>{user.email}</div>
          </div>
          <div>
            <div style={{ color: 'var(--sd-muted)', marginBottom: '2px' }}>Date of Birth</div>
            <div style={{ color: 'var(--sd-text)', fontWeight: 500 }}>{user.dateOfBirth}</div>
          </div>
        </div>
      </div>

      {/* Terms of Service */}
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '1.25rem',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--sd-text)',
            marginBottom: '12px',
          }}
        >
          Terms of Service &amp; Event Waiver
        </h3>
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '12px',
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'var(--sd-text)',
            background: 'var(--sd-bg)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            marginBottom: '12px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {waiverContent}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--sd-text)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: '2px' }}
          />
          <span>
            I have read, understood, and agree to the Terms of Service and Event Waiver.
          </span>
        </label>
      </div>

      {/* Signature */}
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '1.25rem',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--sd-text)',
            marginBottom: '12px',
          }}
        >
          Digital Signature <span style={{ color: 'var(--sd-red)' }}>*</span>
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '12px' }}>
          Please sign in the box below using your mouse or touch screen.
        </p>
        <SignatureCapture
          value={signature}
          onChange={setSignature}
          isFormValid={isFormValid}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
        />
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            background: 'var(--sd-red-light)',
            border: '1px solid var(--sd-red)',
            borderRadius: 'var(--sd-radius)',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--sd-red)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
