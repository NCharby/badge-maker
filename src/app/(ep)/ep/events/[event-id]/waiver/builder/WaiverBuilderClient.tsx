'use client'

import { useState, useTransition } from 'react'
import { saveWaiverTemplate } from './actions'

interface PastTemplate {
  id: string
  eventId: string
  eventTitle: string
  content: string
}

interface Props {
  eventId: string
  existingContent: string | null
  pastTemplates: PastTemplate[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--sd-border)',
  borderRadius: '7px',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  boxSizing: 'border-box',
}

export default function WaiverBuilderClient({ eventId, existingContent, pastTemplates }: Props) {
  const [content, setContent] = useState(existingContent ?? '')
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function loadFromPastTemplate(templateId: string) {
    const source = pastTemplates.find(t => t.id === templateId)
    if (!source) return
    setContent(source.content)
    setSourceTemplateId(source.id)
    setSuccessMsg(`Loaded from "${source.eventTitle}" — this is an independent copy.`)
    setError('')
  }

  function handleSave() {
    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await saveWaiverTemplate(
        eventId,
        content,
        sourceTemplateId ?? undefined,
      )
      if (result.error) setError(result.error)
      else setSuccessMsg('Waiver template saved successfully.')
    })
  }

  return (
    <div>
      {/* Copy from past event */}
      {pastTemplates.length > 0 && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--sd-muted)', flexShrink: 0 }}>Reuse from past event:</span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) loadFromPastTemplate(e.target.value) }}
            style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: '180px' }}
          >
            <option value="">Select a template...</option>
            {pastTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.eventTitle}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Loading copies — original is not affected.</span>
        </div>
      )}

      {/* Waiver content textarea */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--sd-text)' }}>
          Waiver Content <span style={{ color: 'var(--sd-red)' }}>*</span>
        </label>
        <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '8px' }}>
          Enter the full text of the waiver that attendees will read and sign. This text appears on the attendee waiver page and in the generated PDF.
        </p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Enter waiver terms, release of liability, code of conduct, and any other legal text for this event..."
          rows={20}
          style={{
            ...inputStyle,
            resize: 'vertical',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            minHeight: '300px',
          }}
        />
      </div>

      {/* Preview */}
      {content.trim() && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--sd-text)' }}>
            Preview
          </label>
          <div style={{
            background: 'var(--sd-bg)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '16px',
            maxHeight: '300px',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'var(--sd-text)',
            whiteSpace: 'pre-wrap',
          }}>
            {content}
          </div>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <p style={{ fontSize: '13px', color: 'var(--sd-red)', marginBottom: '12px' }}>{error}</p>
      )}
      {successMsg && (
        <p style={{ fontSize: '13px', color: 'var(--sd-green-dark)', marginBottom: '12px' }}>{successMsg}</p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isPending}
        style={{
          padding: '10px 24px',
          borderRadius: '7px',
          border: 'none',
          background: isPending ? 'var(--sd-muted)' : 'var(--sd-purple)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Saving...' : 'Save template'}
      </button>
    </div>
  )
}
