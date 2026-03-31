'use client'

import { useState, useTransition } from 'react'
import { notifyIncomplete } from './actions'

export type LockCheckRow = {
  userId: string
  displayName: string
  lockStatus: string
  incompleteModules: string[]
  completedModules: string[]
}

export type RequiredModule = { key: string; label: string }

interface Props {
  eventId: string
  eventTitle: string
  requiredModules: RequiredModule[]
  rows: LockCheckRow[]
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  Locked:          { background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
  'Ready to Lock': { background: 'var(--sd-amber-light)', color: '#92400e' },
  Unlocked:        { background: '#F3F4F6', color: '#6B7280' },
}

export default function LockCheckClient({ eventId, eventTitle, requiredModules, rows }: Props) {
  const [isPending, startTransition] = useTransition()
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({})
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const incompleteRows = rows.filter(r => r.incompleteModules.length > 0)

  function handleNotifyOne(userId: string) {
    startTransition(async () => {
      setRowStatus(prev => ({ ...prev, [userId]: 'Sending…' }))
      const result = await notifyIncomplete(eventId, userId)
      if ('error' in result) {
        setRowStatus(prev => ({ ...prev, [userId]: `Error: ${result.error}` }))
      } else {
        setRowStatus(prev => ({ ...prev, [userId]: result.count > 0 ? 'Notified ✓' : 'Already complete' }))
      }
    })
  }

  function handleNotifyAll() {
    startTransition(async () => {
      setBulkStatus('Sending…')
      const result = await notifyIncomplete(eventId, null)
      if ('error' in result) {
        setBulkStatus(`Error: ${result.error}`)
      } else {
        setBulkStatus(`Sent to ${result.count} attendee${result.count !== 1 ? 's' : ''} ✓`)
      }
    })
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--sd-muted)',
    padding: '8px 12px',
    borderBottom: '2px solid var(--sd-border)',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    fontSize: '13px',
    padding: '10px 12px',
    borderBottom: '1px solid var(--sd-border)',
    verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          <strong style={{ color: 'var(--sd-text)' }}>{incompleteRows.length}</strong> of{' '}
          <strong style={{ color: 'var(--sd-text)' }}>{rows.length}</strong> attendees have incomplete required steps.
          {requiredModules.length > 0 && (
            <span style={{ marginLeft: '8px' }}>
              Required: {requiredModules.map(m => m.label).join(', ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {bulkStatus && (
            <span style={{ fontSize: '13px', color: 'var(--sd-green-dark)' }}>{bulkStatus}</span>
          )}
          <button
            onClick={handleNotifyAll}
            disabled={isPending || incompleteRows.length === 0}
            style={{
              padding: '8px 16px',
              background: incompleteRows.length === 0 ? '#E5E7EB' : 'var(--sd-purple)',
              color: incompleteRows.length === 0 ? 'var(--sd-muted)' : '#fff',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: incompleteRows.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Notify All Incomplete ({incompleteRows.length})
          </button>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--sd-muted)',
        }}>
          No attendees found for this event.
        </div>
      ) : (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          overflow: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Attendee</th>
                <th style={th}>Lock Status</th>
                {requiredModules.map(m => (
                  <th key={m.key} style={th}>{m.label}</th>
                ))}
                <th style={{ ...th, textAlign: 'right' }}>Notify</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const incomplete = row.incompleteModules.length > 0
                const lockStyle = STATUS_STYLE[row.lockStatus] ?? STATUS_STYLE.Unlocked
                return (
                  <tr
                    key={row.userId}
                    style={{ background: incomplete ? '#FFFBEB' : 'transparent' }}
                  >
                    <td style={td}>
                      <span style={{ fontWeight: 500, color: 'var(--sd-text)' }}>{row.displayName}</span>
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '3px 10px',
                        borderRadius: '99px',
                        ...lockStyle,
                      }}>
                        {row.lockStatus}
                      </span>
                    </td>
                    {requiredModules.map(m => {
                      const done = !row.incompleteModules.includes(m.label)
                      return (
                        <td key={m.key} style={{ ...td, textAlign: 'center' }}>
                          {done
                            ? <span style={{ color: 'var(--sd-green-dark)', fontSize: '15px' }}>✓</span>
                            : <span style={{ color: '#D97706', fontSize: '12px', fontWeight: 600 }}>Incomplete</span>
                          }
                        </td>
                      )
                    })}
                    <td style={{ ...td, textAlign: 'right' }}>
                      {rowStatus[row.userId] ? (
                        <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                          {rowStatus[row.userId]}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleNotifyOne(row.userId)}
                          disabled={isPending || !incomplete}
                          style={{
                            padding: '5px 12px',
                            background: incomplete ? 'none' : 'none',
                            border: `1px solid ${incomplete ? 'var(--sd-purple)' : 'var(--sd-border)'}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: incomplete ? 'var(--sd-purple)' : 'var(--sd-muted)',
                            cursor: incomplete ? 'pointer' : 'not-allowed',
                            opacity: isPending ? 0.6 : 1,
                          }}
                        >
                          Notify
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
