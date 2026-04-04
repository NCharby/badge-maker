'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventDetails } from './actions'

const DRAFT_STATUS = 'Draft'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '6px',
}

interface Props {
  eventId: string
  currentStatus: string
  initialValues: {
    title: string
    description: string
    start_date: string
    end_date: string
    room_lock_in_date: string
    late_registration_enabled: boolean
    late_registration_email: string
  }
}

export default function EditEventClient({ eventId, currentStatus, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const [title, setTitle] = useState(initialValues.title)
  const [description, setDescription] = useState(initialValues.description)
  const [startDate, setStartDate] = useState(initialValues.start_date)
  const [endDate, setEndDate] = useState(initialValues.end_date)
  const [roomLockInDate, setRoomLockInDate] = useState(initialValues.room_lock_in_date)
  const [lateRegEnabled, setLateRegEnabled] = useState(initialValues.late_registration_enabled)
  const [lateRegEmail, setLateRegEmail] = useState(initialValues.late_registration_email)

  const isPublished = currentStatus !== DRAFT_STATUS

  function handleSave() {
    setError('')
    if (!title.trim()) { setError('Event title is required.'); return }
    if (!startDate) { setError('Start date is required.'); return }
    if (startDate < today) { setError('Start date cannot be in the past.'); return }
    if (!endDate) { setError('End date is required.'); return }
    if (endDate < startDate) { setError('End date must be on or after start date.'); return }

    startTransition(async () => {
      const result = await updateEventDetails(eventId, {
        title, description, start_date: startDate, end_date: endDate,
        room_lock_in_date: roomLockInDate,
        late_registration_enabled: lateRegEnabled,
        late_registration_email: lateRegEmail,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/ep/events/${eventId}`)
      }
    })
  }

  return (
    <>
      {isPublished && (
        <div style={{
          background: 'var(--sd-amber-light)',
          border: '1px solid #FCD34D',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '13px',
          color: '#92400e',
          marginBottom: '20px',
        }}>
          <strong>Warning:</strong> This event is currently <strong>{currentStatus}</strong>. Changes to event details will be visible to users immediately.
        </div>
      )}

      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div>
          <label style={labelStyle}>Event Title *</label>
          <input
            style={inputStyle}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Start Date *</label>
            <input
              type="date"
              min={today}
              style={inputStyle}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>End Date *</label>
            <input
              type="date"
              min={startDate}
              style={inputStyle}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Room Lock-In Date</label>
          <input
            type="datetime-local"
            style={inputStyle}
            value={roomLockInDate}
            onChange={e => {
              const val = e.target.value
              setRoomLockInDate(val && !val.includes('T') ? val + 'T00:00' : val)
            }}
          />
          <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px' }}>
            The deadline for all attendees to finalize their room selections. Time defaults to 12:00 AM if not specified. Required for lock countdown notifications.
          </p>
        </div>

        {/* Late Registration */}
        <div style={{ borderTop: '1px solid var(--sd-border)', paddingTop: '18px' }}>
          <label style={{ ...labelStyle, textTransform: 'none', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={lateRegEnabled}
              onChange={e => setLateRegEnabled(e.target.checked)}
              style={{ accentColor: 'var(--sd-purple)' }}
            />
            Enable &quot;Contact Promoter&quot; for closing-soon events
          </label>
          <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: lateRegEnabled ? '12px' : 0 }}>
            When enabled, users who can no longer begin the attendance process will see a &quot;Contact Promoter&quot; button on the browse page.
          </p>
          {lateRegEnabled && (
            <div>
              <label style={labelStyle}>Alternate Contact Email</label>
              <input
                type="email"
                style={inputStyle}
                value={lateRegEmail}
                onChange={e => setLateRegEmail(e.target.value)}
                placeholder="Leave blank to use your account email"
              />
              <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px' }}>
                Inquiries will be sent to this address. If blank, your account email is used.
              </p>
            </div>
          )}
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: '7px',
              border: 'none',
              background: isPending ? '#E5E7EB' : 'var(--sd-purple)',
              color: isPending ? 'var(--sd-muted)' : '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
