'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTicketType, updateTicketType, deleteTicketType, type TicketTypeInput } from './actions'

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  available_count: number | null
  room_lead: boolean
  roommate_codes_enabled: boolean
  volunteer_hours_required: number
  room_required_at_purchase: boolean
}

const emptyForm: TicketTypeInput = {
  name: '',
  description: '',
  price: '0',
  available_count: '',
  room_lead: false,
  roommate_codes_enabled: false,
  volunteer_hours_required: '0',
  room_required_at_purchase: false,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: '6px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

// ── TicketForm — top-level to avoid re-mount on parent renders ─────────────────

interface TicketFormProps {
  form: TicketTypeInput
  setForm: (updater: (prev: TicketTypeInput) => TicketTypeInput) => void
  error: string
  isPending: boolean
  onSave: () => void
  onCancel: () => void
}

function TicketForm({ form, setForm, error, isPending, onSave, onCancel }: TicketFormProps) {
  return (
    <div style={{
      background: 'var(--sd-card2)',
      border: '1px solid var(--sd-border)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Name *</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. General Admission"
          />
        </div>

        <div>
          <label style={labelStyle}>Price ($)</label>
          <input
            type="number" min="0" step="0.01"
            style={inputStyle}
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          />
        </div>

        <div>
          <label style={labelStyle}>Available Count</label>
          <input
            type="number" min="1"
            style={inputStyle}
            value={form.available_count}
            onChange={e => setForm(f => ({ ...f, available_count: e.target.value }))}
            placeholder="Blank = unlimited"
          />
        </div>

        <div>
          <label style={labelStyle}>Volunteer Hours Required</label>
          <input
            type="number" min="0"
            style={inputStyle}
            value={form.volunteer_hours_required}
            onChange={e => setForm(f => ({ ...f, volunteer_hours_required: e.target.value }))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.room_lead}
              onChange={e => setForm(f => ({
                ...f,
                room_lead: e.target.checked,
                // Clear roommate codes when room_lead is unchecked
                roommate_codes_enabled: e.target.checked ? f.roommate_codes_enabled : false,
              }))}
              style={{ accentColor: 'var(--sd-purple)' }}
            />
            Room Lead
          </label>
          {form.room_lead && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer', paddingLeft: '20px' }}>
              <input
                type="checkbox"
                checked={form.roommate_codes_enabled}
                onChange={e => setForm(f => ({ ...f, roommate_codes_enabled: e.target.checked }))}
                style={{ accentColor: 'var(--sd-purple)' }}
              />
              Enable Roommate Codes
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.room_required_at_purchase}
              onChange={e => setForm(f => ({ ...f, room_required_at_purchase: e.target.checked }))}
              style={{ accentColor: 'var(--sd-purple)' }}
            />
            Require room at checkout
          </label>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '56px' }}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          disabled={isPending}
          style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '13px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            border: 'none',
            background: isPending ? '#E5E7EB' : 'var(--sd-purple)',
            color: isPending ? 'var(--sd-muted)' : '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── TicketsClient ──────────────────────────────────────────────────────────────

export default function TicketsClient({
  eventId,
  eventTitle,
  ticketTypes,
}: {
  eventId: string
  eventTitle: string
  ticketTypes: TicketType[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'creating' | { editing: string }>('idle')
  const [form, setForm] = useState<TicketTypeInput>(emptyForm)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  function startCreate() {
    setForm(emptyForm)
    setError('')
    setMode('creating')
  }

  function startEdit(tt: TicketType) {
    setForm({
      name: tt.name,
      description: tt.description ?? '',
      price: String(tt.price),
      available_count: tt.available_count === null ? '' : String(tt.available_count),
      room_lead: tt.room_lead,
      roommate_codes_enabled: tt.roommate_codes_enabled,
      volunteer_hours_required: String(tt.volunteer_hours_required),
      room_required_at_purchase: tt.room_required_at_purchase,
    })
    setError('')
    setMode({ editing: tt.id })
  }

  function cancel() {
    setMode('idle')
    setError('')
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result =
        mode === 'creating'
          ? await createTicketType(eventId, form)
          : await updateTicketType((mode as { editing: string }).editing, eventId, form)
      if ('error' in result) {
        setError(result.error)
      } else {
        setMode('idle')
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    setDeleteErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    startTransition(async () => {
      const result = await deleteTicketType(id, eventId)
      if ('error' in result) {
        setDeleteErrors(prev => ({ ...prev, [id]: result.error }))
        setConfirmDelete(null)
      } else {
        setConfirmDelete(null)
        router.refresh()
      }
    })
  }

  function formatPrice(price: number) {
    return price === 0 ? 'Free' : `$${Number(price).toFixed(2)}`
  }

  const isEditing = (id: string) => typeof mode === 'object' && (mode as { editing: string }).editing === id
  const isIdle = mode === 'idle'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '2px' }}>
            Ticket Types
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>{eventTitle}</p>
        </div>
        {isIdle && (
          <button
            onClick={startCreate}
            style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Ticket Type
          </button>
        )}
      </div>

      {mode === 'creating' && (
        <div style={{ marginBottom: '16px' }}>
          <TicketForm
            form={form}
            setForm={setForm}
            error={error}
            isPending={isPending}
            onSave={handleSave}
            onCancel={cancel}
          />
        </div>
      )}

      {ticketTypes.length === 0 && mode !== 'creating' ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
          fontSize: '14px',
        }}>
          No ticket types yet. Click &ldquo;+ Add Ticket Type&rdquo; to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ticketTypes.map(tt => (
            <div key={tt.id}>
              {isEditing(tt.id) ? (
                <TicketForm
                  form={form}
                  setForm={setForm}
                  error={error}
                  isPending={isPending}
                  onSave={handleSave}
                  onCancel={cancel}
                />
              ) : (
                <div style={{
                  background: 'var(--sd-card)',
                  border: '1px solid var(--sd-border)',
                  borderRadius: 'var(--sd-radius)',
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>{tt.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-green-dark)' }}>
                          {formatPrice(Number(tt.price))}
                        </span>
                        {tt.room_lead && (
                          <span style={{ fontSize: '11px', background: '#ede9fe', color: '#7c3aed', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>
                            Room Lead
                          </span>
                        )}
                        {tt.roommate_codes_enabled && (
                          <span style={{ fontSize: '11px', background: '#d1fae5', color: '#065f46', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>
                            Codes On
                          </span>
                        )}
                        {tt.volunteer_hours_required > 0 && (
                          <span style={{ fontSize: '11px', background: 'var(--sd-amber-light)', color: '#92400e', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>
                            {tt.volunteer_hours_required}h volunteer
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                        {tt.available_count === null ? 'Unlimited' : `${tt.available_count} available`}
                        {tt.description && ` · ${tt.description}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(tt)}
                        disabled={!isIdle || isPending}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-text)', fontSize: '12px', cursor: !isIdle ? 'not-allowed' : 'pointer' }}
                      >
                        Edit
                      </button>

                      {confirmDelete === tt.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Delete?</span>
                          <button
                            onClick={() => handleDelete(tt.id)}
                            disabled={isPending}
                            style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'var(--sd-red)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '12px', cursor: 'pointer' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setDeleteErrors(prev => { const n = { ...prev }; delete n[tt.id]; return n }); setConfirmDelete(tt.id) }}
                          disabled={!isIdle || isPending}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-red)', fontSize: '12px', cursor: !isIdle ? 'not-allowed' : 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {deleteErrors[tt.id] && (
                    <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '8px', marginBottom: 0 }}>
                      {deleteErrors[tt.id]}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
