'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventStatus } from './actions'
import type { WorkflowStatus } from '@/types/platform'

const SYSTEM_BEFORE = ['Draft', 'Published']
const SYSTEM_AFTER = ['Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

export default function EventStatusClient({
  eventId,
  currentStatus,
  workflowStatuses = [],
}: {
  eventId: string
  currentStatus: string
  workflowStatuses?: WorkflowStatus[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(currentStatus)
  const [error, setError] = useState('')

  const sorted = [...workflowStatuses].sort((a, b) => a.order - b.order)

  function handleUpdate() {
    if (selected === currentStatus) return
    setError('')
    startTransition(async () => {
      const result = await updateEventStatus(eventId, selected)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={isPending}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid var(--sd-border)',
          fontSize: '13px',
          color: 'var(--sd-text)',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        <optgroup label="System">
          {SYSTEM_BEFORE.map(s => <option key={s} value={s}>{s}</option>)}
        </optgroup>
        {sorted.length > 0 && (
          <optgroup label="Custom">
            {sorted.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </optgroup>
        )}
        <optgroup label="System">
          {SYSTEM_AFTER.map(s => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      </select>
      <button
        onClick={handleUpdate}
        disabled={isPending || selected === currentStatus}
        style={{
          padding: '6px 14px',
          borderRadius: '6px',
          border: 'none',
          background: (isPending || selected === currentStatus) ? '#E5E7EB' : 'var(--sd-purple)',
          color: (isPending || selected === currentStatus) ? 'var(--sd-muted)' : '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: (isPending || selected === currentStatus) ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Saving…' : 'Update Status'}
      </button>
      {error && <span style={{ fontSize: '12px', color: 'var(--sd-red)' }}>{error}</span>}
    </div>
  )
}
