'use client'

import { useState, useTransition } from 'react'
import { saveDraft, submitApplication, withdrawApplication } from './actions'

interface FormField {
  id: string
  type: 'text' | 'radio' | 'checkbox' | 'key_value'
  label: string
  options: string[]
  required: boolean
  order: number
}

interface Props {
  eventId: string
  formId: string
  fields: FormField[]
  initialResponses: Record<string, unknown>
  applicationStatus: string
  isLocked: boolean
}

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
  resize: 'vertical',
}

export default function ApplicationForm({
  eventId,
  formId,
  fields,
  initialResponses,
  applicationStatus,
  isLocked,
}: Props) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses)
  const [globalError, setGlobalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const readOnly =
    isLocked ||
    applicationStatus === 'Closed' ||
    applicationStatus === 'Approved' ||
    applicationStatus === 'Declined'

  function setField(fieldId: string, value: unknown) {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
    setGlobalError('')
    setSuccessMsg('')
  }

  function validateRequired(): string | null {
    for (const f of fields) {
      if (!f.required) continue
      const val = responses[f.id]
      if (val === undefined || val === null || val === '') return `"${f.label}" is required.`
      if (Array.isArray(val) && val.length === 0) return `"${f.label}" is required.`
    }
    return null
  }

  function handleSaveDraft() {
    setGlobalError('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await saveDraft(eventId, formId, responses)
      if (result.error) setGlobalError(result.error)
      else setSuccessMsg('Draft saved.')
    })
  }

  function handleSubmit() {
    const validationError = validateRequired()
    if (validationError) { setGlobalError(validationError); return }
    setGlobalError('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await submitApplication(eventId, formId, responses)
      if (result.error) setGlobalError(result.error)
      else setSuccessMsg('Application submitted! The event promoter will review your application.')
    })
  }

  function handleWithdraw() {
    if (!confirm('Withdraw your application? This will reset your status to Incomplete.')) return
    setGlobalError('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await withdrawApplication(eventId)
      if (result.error) setGlobalError(result.error)
    })
  }

  return (
    <div>
      {globalError && (
        <div style={{
          background: 'var(--sd-red-light)',
          border: '1px solid #FCA5A5',
          color: '#991b1b',
          borderRadius: '7px',
          padding: '10px 14px',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {globalError}
        </div>
      )}
      {successMsg && (
        <div style={{
          background: 'var(--sd-green-light)',
          border: '1px solid var(--sd-green)',
          color: 'var(--sd-green-dark)',
          borderRadius: '7px',
          padding: '10px 14px',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
        {[...fields].sort((a, b) => a.order - b.order).map(field => (
          <div key={field.id}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--sd-text)' }}>
              {field.label}
              {field.required && <span style={{ color: 'var(--sd-red)', marginLeft: '4px' }}>*</span>}
            </label>

            {field.type === 'text' && (
              <textarea
                style={inputStyle}
                rows={3}
                value={(responses[field.id] as string) ?? ''}
                onChange={e => setField(field.id, e.target.value)}
                disabled={readOnly}
                placeholder={readOnly ? '' : 'Your answer…'}
              />
            )}

            {field.type === 'radio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {field.options.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: readOnly ? 'default' : 'pointer' }}>
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={responses[field.id] === opt}
                      onChange={() => setField(field.id, opt)}
                      disabled={readOnly}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {field.type === 'checkbox' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {field.options.map(opt => {
                  const checked = Array.isArray(responses[field.id])
                    ? (responses[field.id] as string[]).includes(opt)
                    : false
                  return (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: readOnly ? 'default' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const current = (responses[field.id] as string[]) ?? []
                          setField(
                            field.id,
                            e.target.checked ? [...current, opt] : current.filter(v => v !== opt)
                          )
                        }}
                        disabled={readOnly}
                      />
                      {opt}
                    </label>
                  )
                })}
              </div>
            )}

            {field.type === 'key_value' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, width: '140px', flex: 'none' }}
                  type="text"
                  placeholder="Platform"
                  value={((responses[field.id] as { key?: string; value?: string })?.key) ?? ''}
                  onChange={e => setField(field.id, { ...((responses[field.id] as object) ?? {}), key: e.target.value })}
                  disabled={readOnly}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="text"
                  placeholder="Handle or URL"
                  value={((responses[field.id] as { key?: string; value?: string })?.value) ?? ''}
                  onChange={e => setField(field.id, { ...((responses[field.id] as object) ?? {}), value: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSaveDraft}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: '7px',
              fontSize: '14px',
              fontWeight: 500,
              background: 'var(--sd-card)',
              color: 'var(--sd-text)',
              border: '1px solid var(--sd-border)',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: '7px',
              fontSize: '14px',
              fontWeight: 500,
              background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)',
              color: '#fff',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Submitting…' : 'Submit application'}
          </button>
          {applicationStatus !== 'Incomplete' && (
            <button
              onClick={handleWithdraw}
              disabled={isPending}
              style={{
                padding: '9px 20px',
                borderRadius: '7px',
                fontSize: '14px',
                fontWeight: 500,
                background: 'none',
                color: 'var(--sd-red)',
                border: '1px solid var(--sd-red)',
                cursor: isPending ? 'not-allowed' : 'pointer',
                marginLeft: 'auto',
              }}
            >
              Withdraw
            </button>
          )}
        </div>
      )}

      {readOnly && applicationStatus !== 'Approved' && applicationStatus !== 'Declined' && (
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>
          This application is read-only.
        </p>
      )}
    </div>
  )
}
