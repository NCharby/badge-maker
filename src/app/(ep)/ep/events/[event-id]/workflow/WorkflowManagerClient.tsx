'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkflowStatus } from '@/types/platform'
import {
  addWorkflowStatus,
  renameWorkflowStatus,
  deleteWorkflowStatus,
  reorderWorkflowStatuses,
} from './actions'

const SYSTEM_BEFORE = ['Draft', 'Published']
const SYSTEM_AFTER = ['Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

function SystemStatusPill({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      background: 'var(--sd-card2)',
      border: '1px solid var(--sd-border)',
      borderRadius: '8px',
      fontSize: '13px',
      color: 'var(--sd-muted)',
      fontWeight: 600,
    }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        SYSTEM
      </span>
      {name}
    </div>
  )
}

export default function WorkflowManagerClient({
  eventId,
  initialStatuses,
}: {
  eventId: string
  initialStatuses: WorkflowStatus[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local ordered list (optimistic)
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(
    [...initialStatuses].sort((a, b) => a.order - b.order)
  )
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameInfo, setRenameInfo] = useState('')

  // Add form state
  const [addName, setAddName] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addError, setAddError] = useState('')

  // General error
  const [actionError, setActionError] = useState('')

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...statuses]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setStatuses(next)
    setHasUnsavedOrder(true)
  }

  function moveDown(idx: number) {
    if (idx === statuses.length - 1) return
    const next = [...statuses]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setStatuses(next)
    setHasUnsavedOrder(true)
  }

  function handleSaveOrder() {
    setActionError('')
    startTransition(async () => {
      const result = await reorderWorkflowStatuses(eventId, statuses.map(s => s.id))
      if ('error' in result) {
        setActionError(result.error)
      } else {
        setHasUnsavedOrder(false)
        router.refresh()
      }
    })
  }

  function startRename(status: WorkflowStatus) {
    setRenamingId(status.id)
    setRenameValue(status.name)
    setRenameInfo('')
    setActionError('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
    setRenameInfo('')
  }

  function commitRename(statusId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { cancelRename(); return }
    const existing = statuses.find(s => s.id === statusId)
    if (trimmed === existing?.name) { cancelRename(); return }

    setActionError('')
    startTransition(async () => {
      const result = await renameWorkflowStatus(eventId, statusId, trimmed)
      if ('error' in result) {
        setActionError(result.error)
      } else {
        setStatuses(prev => prev.map(s => s.id === statusId ? { ...s, name: trimmed } : s))
        setRenamingId(null)
        setRenameValue('')
        if (result.hasRefs) {
          setRenameInfo('Renaming updated the display name only — all module triggers and policy checkpoints remain intact via their UUID references.')
        }
        router.refresh()
      }
    })
  }

  function handleDelete(statusId: string, name: string) {
    if (!window.confirm(`Delete custom status "${name}"? This cannot be undone.`)) return
    setActionError('')
    startTransition(async () => {
      const result = await deleteWorkflowStatus(eventId, statusId)
      if ('error' in result) {
        setActionError(result.error)
      } else {
        setStatuses(prev => prev.filter(s => s.id !== statusId))
        setHasUnsavedOrder(false)
        router.refresh()
      }
    })
  }

  function handleAdd() {
    setAddError('')
    if (!addName.trim()) { setAddError('Name is required.'); return }
    startTransition(async () => {
      const result = await addWorkflowStatus(eventId, addName, addDescription)
      if ('error' in result) {
        setAddError(result.error)
      } else {
        setStatuses(prev => [...prev, result.newStatus])
        setAddName('')
        setAddDescription('')
        router.refresh()
      }
    })
  }

  const btnStyle = (variant: 'primary' | 'ghost' | 'danger', disabled = false): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: '6px',
    border: variant === 'ghost' ? '1px solid var(--sd-border)' : 'none',
    background: disabled ? '#E5E7EB' : variant === 'primary' ? 'var(--sd-purple)' : variant === 'danger' ? 'transparent' : 'transparent',
    color: disabled ? 'var(--sd-muted)' : variant === 'primary' ? '#fff' : variant === 'danger' ? '#991b1b' : 'var(--sd-text)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--sd-border)',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--sd-text)',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* System statuses — before */}
      {SYSTEM_BEFORE.map(name => <SystemStatusPill key={name} name={name} />)}

      {/* Connector */}
      <div style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>
        ↓ custom statuses below (drag-free — use arrows to reorder)
      </div>

      {/* Custom status rows */}
      {statuses.length === 0 && (
        <div style={{ padding: '12px 16px', border: '1px dashed var(--sd-border)', borderRadius: '8px', fontSize: '13px', color: 'var(--sd-muted)', textAlign: 'center' }}>
          No custom statuses yet. Add one below.
        </div>
      )}

      {statuses.map((status, idx) => (
        <div key={status.id} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: '8px',
        }}>
          {/* Reorder arrows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            <button onClick={() => moveUp(idx)} disabled={idx === 0 || isPending} title="Move up" style={{ ...btnStyle('ghost', idx === 0 || isPending), padding: '2px 6px' }}>↑</button>
            <button onClick={() => moveDown(idx)} disabled={idx === statuses.length - 1 || isPending} title="Move down" style={{ ...btnStyle('ghost', idx === statuses.length - 1 || isPending), padding: '2px 6px' }}>↓</button>
          </div>

          {/* Name / rename input */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {renamingId === status.id ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(status.id)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  autoFocus
                  style={{ ...inputStyle, width: '200px' }}
                />
                <button onClick={() => commitRename(status.id)} disabled={isPending} style={btnStyle('primary', isPending)}>Save</button>
                <button onClick={cancelRename} style={btnStyle('ghost')}>Cancel</button>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>{status.name}</span>
                {status.description && (
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>{status.description}</div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {renamingId !== status.id && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => startRename(status)} disabled={isPending} style={btnStyle('ghost', isPending)}>Rename</button>
              <button onClick={() => handleDelete(status.id, status.name)} disabled={isPending} style={btnStyle('danger', isPending)}>Delete</button>
            </div>
          )}
        </div>
      ))}

      {/* Save order button */}
      {hasUnsavedOrder && (
        <button onClick={handleSaveOrder} disabled={isPending} style={{ ...btnStyle('primary', isPending), alignSelf: 'flex-start' }}>
          {isPending ? 'Saving…' : 'Save Order'}
        </button>
      )}

      {/* Rename info message */}
      {renameInfo && (
        <div style={{ padding: '10px 14px', background: 'var(--sd-blue-light)', border: '1px solid #93C5FD', borderRadius: '6px', fontSize: '12px', color: '#1e40af' }}>
          {renameInfo}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div style={{ padding: '10px 14px', background: 'var(--sd-red-light)', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '12px', color: '#991b1b' }}>
          {actionError}
        </div>
      )}

      {/* System statuses — after */}
      <div style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>
        ↓ fixed system statuses
      </div>
      {SYSTEM_AFTER.map(name => <SystemStatusPill key={name} name={name} />)}

      {/* Add custom status form */}
      <div style={{
        marginTop: '8px',
        padding: '16px',
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '10px' }}>
          Add Custom Status
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', display: 'block', marginBottom: '4px' }}>
              Name <span style={{ color: '#991b1b' }}>*</span>
            </label>
            <input
              value={addName}
              onChange={e => { setAddName(e.target.value); setAddError('') }}
              placeholder="e.g. Applications Open"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', display: 'block', marginBottom: '4px' }}>
              Description (optional)
            </label>
            <input
              value={addDescription}
              onChange={e => setAddDescription(e.target.value)}
              placeholder="Brief description for this phase"
              style={inputStyle}
            />
          </div>
          {addError && <span style={{ fontSize: '12px', color: '#991b1b' }}>{addError}</span>}
          <button onClick={handleAdd} disabled={isPending} style={{ ...btnStyle('primary', isPending), alignSelf: 'flex-start' }}>
            {isPending ? 'Adding…' : 'Add Status'}
          </button>
        </div>
      </div>
    </div>
  )
}
