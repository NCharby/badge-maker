'use client'

import { useState, useTransition } from 'react'
import { saveForm } from './actions'

type FieldType = 'text' | 'radio' | 'checkbox' | 'key_value'

interface FormField {
  id: string
  type: FieldType
  label: string
  options: string[]
  required: boolean
  order: number
}

interface PastForm {
  id: string
  eventTitle: string
  title: string
  fields: FormField[]
}

interface Props {
  eventId: string
  existingForm: {
    id: string
    title: string
    fields: FormField[]
    sourceFormId: string | null
  } | null
  pastForms: PastForm[]
}

function generateId() {
  return crypto.randomUUID()
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Long text',
  radio: 'Single choice (radio)',
  checkbox: 'Multi-select (checkboxes)',
  key_value: 'Key / value pair',
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

export default function FormBuilderClient({ eventId, existingForm, pastForms }: Props) {
  const [title, setTitle] = useState(existingForm?.title ?? '')
  const [fields, setFields] = useState<FormField[]>(existingForm?.fields ?? [])
  const [showAddField, setShowAddField] = useState(false)
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function moveField(index: number, direction: 'up' | 'down') {
    const updated = [...fields]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= updated.length) return
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    updated.forEach((f, i) => { f.order = i + 1 })
    setFields(updated)
  }

  function deleteField(id: string) {
    const updated = fields.filter(f => f.id !== id)
    updated.forEach((f, i) => { f.order = i + 1 })
    setFields(updated)
  }

  function addField() {
    if (!newFieldLabel.trim()) { setError('Field label is required.'); return }
    if ((newFieldType === 'radio' || newFieldType === 'checkbox') && newFieldOptions.filter(o => o.trim()).length < 2) {
      setError('Add at least 2 options.')
      return
    }
    const field: FormField = {
      id: generateId(),
      type: newFieldType,
      label: newFieldLabel.trim(),
      options: (newFieldType === 'radio' || newFieldType === 'checkbox')
        ? newFieldOptions.filter(o => o.trim())
        : [],
      required: newFieldRequired,
      order: fields.length + 1,
    }
    setFields(prev => [...prev, field])
    setShowAddField(false)
    setNewFieldLabel('')
    setNewFieldType('text')
    setNewFieldRequired(false)
    setNewFieldOptions(['', ''])
    setError('')
  }

  function loadFromPastForm(formId: string) {
    const source = pastForms.find(f => f.id === formId)
    if (!source) return
    setTitle(source.title)
    setFields(source.fields.map((f, i) => ({ ...f, id: generateId(), order: i + 1 })))
    setSuccessMsg(`Loaded from "${source.eventTitle}" — this is an independent copy.`)
  }

  function handleSave() {
    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await saveForm(eventId, title, fields)
      if (result.error) setError(result.error)
      else setSuccessMsg('Form saved successfully.')
    })
  }

  return (
    <div>
      {/* Copy from past event */}
      {pastForms.length > 0 && (
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
            onChange={e => { if (e.target.value) loadFromPastForm(e.target.value) }}
            style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: '180px' }}
          >
            <option value="">Select a form…</option>
            {pastForms.map(f => (
              <option key={f.id} value={f.id}>{f.eventTitle} — {f.title}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Loading copies — original is not affected.</span>
        </div>
      )}

      {/* Form title */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
          Form title <span style={{ color: 'var(--sd-red)' }}>*</span>
        </label>
        <input
          style={inputStyle}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Full Test Event Application"
        />
      </div>

      {/* Fields list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {fields.map((field, index) => (
          <div
            key={field.id}
            style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            {/* Reorder buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
              <button
                onClick={() => moveField(index, 'up')}
                disabled={index === 0}
                style={{
                  width: '24px',
                  height: '24px',
                  border: '1px solid var(--sd-border)',
                  borderRadius: '4px',
                  background: 'none',
                  cursor: index === 0 ? 'default' : 'pointer',
                  color: index === 0 ? 'var(--sd-border)' : 'var(--sd-muted)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Move up"
              >↑</button>
              <button
                onClick={() => moveField(index, 'down')}
                disabled={index === fields.length - 1}
                style={{
                  width: '24px',
                  height: '24px',
                  border: '1px solid var(--sd-border)',
                  borderRadius: '4px',
                  background: 'none',
                  cursor: index === fields.length - 1 ? 'default' : 'pointer',
                  color: index === fields.length - 1 ? 'var(--sd-border)' : 'var(--sd-muted)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Move down"
              >↓</button>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{field.label}</span>
                {field.required && <span style={{ fontSize: '11px', color: 'var(--sd-red)' }}>required</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                {FIELD_TYPE_LABELS[field.type]}
                {field.options.length > 0 && ` · ${field.options.join(', ')}`}
              </div>
            </div>

            <button
              onClick={() => deleteField(field.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--sd-red)',
                background: 'none',
                color: 'var(--sd-red)',
                fontSize: '12px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Remove
            </button>
          </div>
        ))}

        {fields.length === 0 && (
          <div style={{
            background: 'var(--sd-card)',
            border: '1px dashed var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--sd-muted)',
            fontSize: '13px',
          }}>
            No fields yet. Add a field below.
          </div>
        )}
      </div>

      {/* Add field panel */}
      {!showAddField ? (
        <button
          onClick={() => setShowAddField(true)}
          style={{
            padding: '8px 18px',
            borderRadius: '7px',
            border: '1px dashed var(--sd-border)',
            background: 'none',
            color: 'var(--sd-muted)',
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '24px',
          }}
        >
          + Add field
        </button>
      ) : (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '16px' }}>New field</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--sd-muted)' }}>Field type</label>
              <select
                value={newFieldType}
                onChange={e => { setNewFieldType(e.target.value as FieldType); setNewFieldOptions(['', '']) }}
                style={inputStyle}
              >
                {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--sd-muted)' }}>Label <span style={{ color: 'var(--sd-red)' }}>*</span></label>
              <input
                style={inputStyle}
                type="text"
                value={newFieldLabel}
                onChange={e => setNewFieldLabel(e.target.value)}
                placeholder="Question text"
              />
            </div>

            {(newFieldType === 'radio' || newFieldType === 'checkbox') && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--sd-muted)' }}>Options</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {newFieldOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px' }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="text"
                        value={opt}
                        onChange={e => {
                          const updated = [...newFieldOptions]
                          updated[i] = e.target.value
                          setNewFieldOptions(updated)
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                      {newFieldOptions.length > 2 && (
                        <button
                          onClick={() => setNewFieldOptions(newFieldOptions.filter((_, j) => j !== i))}
                          style={{ padding: '4px 8px', border: '1px solid var(--sd-border)', borderRadius: '6px', background: 'none', color: 'var(--sd-muted)', cursor: 'pointer', fontSize: '12px' }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setNewFieldOptions([...newFieldOptions, ''])}
                    style={{ alignSelf: 'flex-start', padding: '4px 10px', border: '1px dashed var(--sd-border)', borderRadius: '6px', background: 'none', color: 'var(--sd-muted)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    + Add option
                  </button>
                </div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newFieldRequired}
                onChange={e => setNewFieldRequired(e.target.checked)}
              />
              Required
            </label>

            {error && <p style={{ fontSize: '12px', color: 'var(--sd-red)' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={addField}
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  border: 'none',
                  background: 'var(--sd-purple)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add field
              </button>
              <button
                onClick={() => { setShowAddField(false); setError(''); setNewFieldLabel(''); setNewFieldOptions(['', '']) }}
                style={{
                  padding: '8px 14px',
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
        </div>
      )}

      {/* Save / status */}
      {error && !showAddField && (
        <p style={{ fontSize: '13px', color: 'var(--sd-red)', marginBottom: '12px' }}>{error}</p>
      )}
      {successMsg && (
        <p style={{ fontSize: '13px', color: 'var(--sd-green-dark)', marginBottom: '12px' }}>{successMsg}</p>
      )}

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
        {isPending ? 'Saving…' : 'Save form'}
      </button>
    </div>
  )
}
