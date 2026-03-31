'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventVenue } from './actions'

interface Props {
  eventId: string
  currentVenueId: string | null
  venues: { id: string; name: string }[]
}

export default function VenueSelectClient({ eventId, currentVenueId, venues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(currentVenueId ?? '')
  const [error, setError] = useState('')

  const isDirty = selected !== (currentVenueId ?? '')

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = await updateEventVenue(eventId, selected || null)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (venues.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', margin: 0 }}>
        No venues found.{' '}
        <a href="/ep/venues/new" style={{ color: 'var(--sd-purple)', textDecoration: 'none' }}>
          Create a venue →
        </a>
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{
          padding: '7px 10px',
          borderRadius: '6px',
          border: '1px solid var(--sd-border)',
          fontSize: '13px',
          color: 'var(--sd-text)',
          background: '#fff',
          minWidth: '220px',
        }}
      >
        <option value="">— No venue —</option>
        {venues.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>

      {isDirty && (
        <button
          onClick={handleSave}
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
      )}

      {error && <span style={{ fontSize: '12px', color: 'var(--sd-red)' }}>{error}</span>}
    </div>
  )
}
