'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEvent } from './actions'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
  boxSizing: 'border-box' as const,
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

export default function NewEventClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [modules, setModules] = useState({
    venue: false,
    application: false,
    waiver: false,
    room_selection: false,
    volunteering: false,
    schedule: false,
    badge: false,
  })

  function toggleModule(key: keyof typeof modules) {
    setModules(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // venue and room_selection are mutually exclusive
      if (key === 'venue'          && next.venue)          next.room_selection = false
      if (key === 'room_selection' && next.room_selection) next.venue = false
      return next
    })
  }

  function handleSubmit() {
    setError('')
    if (!title.trim()) { setError('Event title is required.'); return }
    if (!startDate) { setError('Start date is required.'); return }
    if (startDate < today) { setError('Start date cannot be in the past.'); return }
    if (!endDate) { setError('End date is required.'); return }
    if (endDate < startDate) { setError('End date must be on or after start date.'); return }

    startTransition(async () => {
      const result = await createEvent({
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        location,
        modules,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/ep/events/${result.eventId}`)
      }
    })
  }

  return (
    <>
      <Link
        href="/ep/dashboard"
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← Dashboard
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1.5rem' }}>
        New Event
      </h1>

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
            placeholder="e.g. Camp Shiny Dog 2026"
          />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the event"
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
              min={startDate || today}
              style={inputStyle}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Location</label>
          <input
            style={inputStyle}
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Physical address"
          />
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Modules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Ticketing — always required */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" checked disabled style={{ accentColor: 'var(--sd-purple)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--sd-muted)', fontWeight: 500 }}>
                  Ticketing <span style={{ fontSize: '11px' }}>(required)</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                  Sell or distribute tickets to attendees.
                </div>
              </div>
            </div>

            {([
              { key: 'application',  label: 'Application', desc: 'Require attendees to fill out an application form before purchasing a ticket.' },
              { key: 'waiver',       label: 'Waiver',      desc: 'Collect signed waivers via Odoo. A waiver template must be configured separately.' },
              { key: 'volunteering', label: 'Volunteering',desc: 'Create volunteer shifts and let attendees sign up. Ticket types can require minimum hours.' },
              { key: 'schedule',     label: 'Schedule',    desc: 'Publish an event schedule visible to attendees.' },
              { key: 'badge',        label: 'Badge',       desc: 'Enable the badge maker so attendees can create a personalized event badge.' },
            ] as const).map(({ key, label, desc }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={modules[key]}
                  onChange={() => toggleModule(key)}
                  style={{ accentColor: 'var(--sd-purple)', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--sd-text)', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{desc}</div>
                </div>
              </label>
            ))}

            {/* Room setup — choose one. Venue and Room Selection are mutually exclusive. */}
            <div style={{ borderTop: '1px solid var(--sd-border)', paddingTop: '10px', marginTop: '2px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Room Setup — choose one
              </div>
              {([
                { key: 'venue',          label: 'Venue',              desc: 'A reusable location object with optional contact details. Add a Room Matrix to the venue to enable room selection for attendees. Assign the specific venue in Event Settings after creation.' },
                { key: 'room_selection', label: 'Basic Event Rooms', desc: 'An event-specific Room Matrix tied to this event only — not reusable across events. Add rooms after creation to enable room selection for attendees.' },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={modules[key]}
                    onChange={() => toggleModule(key)}
                    style={{ accentColor: 'var(--sd-purple)', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--sd-text)', fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Link
            href="/ep/dashboard"
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: '1px solid var(--sd-border)',
              color: 'var(--sd-muted)',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
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
            {isPending ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </div>
    </>
  )
}
