'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createVenue } from './actions'

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

export default function NewVenueClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pocName, setPocName] = useState('')
  const [pocPhone, setPocPhone] = useState('')
  const [pocEmail, setPocEmail] = useState('')

  function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('Venue name is required.'); return }
    if (!address.trim()) { setError('Physical address is required.'); return }

    startTransition(async () => {
      const result = await createVenue({ name, physical_address: address, website, email, phone, poc_name: pocName, poc_phone: pocPhone, poc_email: pocEmail })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/ep/venues/${result.venueId}`)
      }
    })
  }

  return (
    <>
      <Link
        href="/ep/venues"
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← Venues
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1.5rem' }}>
        New Venue
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
          <label style={labelStyle}>Venue Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Grand Hotel & Conference Center"
          />
        </div>

        <div>
          <label style={labelStyle}>Physical Address *</label>
          <input
            style={inputStyle}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="123 Main St, City, State 12345"
          />
        </div>

        <div>
          <label style={labelStyle}>Website</label>
          <input
            style={inputStyle}
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              style={inputStyle}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hotel@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Event Point of Contact</div>
          <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '12px' }}>
            The venue contact for event-specific reports and notifications (weekly hotel report, room lock list).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>POC Name</label>
              <input
                style={inputStyle}
                value={pocName}
                onChange={e => setPocName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>POC Email</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={pocEmail}
                  onChange={e => setPocEmail(e.target.value)}
                  placeholder="poc@venue.com"
                />
              </div>
              <div>
                <label style={labelStyle}>POC Phone</label>
                <input
                  style={inputStyle}
                  value={pocPhone}
                  onChange={e => setPocPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Link
            href="/ep/venues"
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
            {isPending ? 'Creating…' : 'Create Venue'}
          </button>
        </div>
      </div>
    </>
  )
}
