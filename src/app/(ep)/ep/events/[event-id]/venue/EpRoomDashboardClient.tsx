'use client'

import { useState, useTransition } from 'react'
import {
  epBlockRoom, epUnblockRoom,
  epReserveRoom, epUnreserveRoom,
  epBlockBed, epUnblockBed,
  epAssignAttendee, epRemoveAttendee,
  epLockRoom, epUnlockRoom,
  type EpAssignWarning,
} from './actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EpRoomOccupant {
  user_id: string
  display_name: string
  room_status: string
  placed_via_code: boolean
  is_room_lead: boolean
  user_locked: boolean
  room_lead_locked: boolean
}

export interface EpRoomCard {
  id: string
  name: string
  number: string | null
  lodging_type: string | null
  bed_type: string | null
  bed_spot_count: number
  min_occupancy: number
  blocked: boolean
  block_note: string | null
  reserved: boolean
  reservation_note: string | null
  reservation_note_public: boolean
  blocked_beds: number[]
  occupants: EpRoomOccupant[]
}

export interface RoomStats {
  total: number
  blocked: number
  reserved: number
  occupied: number
  open: number
}

interface Props {
  eventId: string
  rooms: EpRoomCard[]
  stats: RoomStats
}

// ─── Warning modal ─────────────────────────────────────────────────────────────

interface PendingAssignment {
  roomId: string
  userEmail: string
  warning: EpAssignWarning
  message: string
}

// ─── Single room card ──────────────────────────────────────────────────────────

function RoomManageCard({
  room,
  eventId,
}: {
  room: EpRoomCard
  eventId: string
}) {
  const [expandBeds, setExpandBeds] = useState(false)
  const [expandOccupants, setExpandOccupants] = useState(false)
  const [blockNote, setBlockNote] = useState(room.block_note ?? '')
  const [reserveNote, setReserveNote] = useState(room.reservation_note ?? '')
  const [reserveNotePublic, setReserveNotePublic] = useState(room.reservation_note_public)
  const [assignEmail, setAssignEmail] = useState('')
  const [assignError, setAssignError] = useState('')
  const [pendingAssign, setPendingAssign] = useState<PendingAssignment | null>(null)
  const [actionError, setActionError] = useState('')
  const [isPending, startTransition] = useTransition()

  function doAction(fn: () => Promise<{ success: true } | { error: string }>) {
    setActionError('')
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) setActionError(result.error)
    })
  }

  function handleBlock() {
    doAction(() => epBlockRoom(eventId, room.id, blockNote || undefined))
  }

  function handleUnblock() {
    doAction(() => epUnblockRoom(eventId, room.id))
  }

  function handleReserve() {
    doAction(() => epReserveRoom(eventId, room.id, reserveNote || undefined, reserveNotePublic))
  }

  function handleNotePublicChange(checked: boolean) {
    setReserveNotePublic(checked)
    if (room.reserved) {
      doAction(() => epReserveRoom(eventId, room.id, reserveNote || undefined, checked))
    }
  }

  function handleUnreserve() {
    doAction(() => epUnreserveRoom(eventId, room.id))
  }

  function handleBlockBed(bedNum: number) {
    doAction(() => epBlockBed(eventId, room.id, bedNum))
  }

  function handleUnblockBed(bedNum: number) {
    doAction(() => epUnblockBed(eventId, room.id, bedNum))
  }

  const allOccupantsLocked = room.occupants.length > 0 && room.occupants.every(o => o.room_lead_locked)

  function handleLockRoom() {
    doAction(() => epLockRoom(eventId, room.id))
  }

  function handleUnlockRoom() {
    doAction(() => epUnlockRoom(eventId, room.id))
  }

  function handleAssignSubmit() {
    if (!assignEmail.trim()) return
    setAssignError('')
    startTransition(async () => {
      const result = await epAssignAttendee(eventId, room.id, assignEmail.trim())
      if ('error' in result) {
        setAssignError(result.error)
      } else if ('warning' in result) {
        setPendingAssign({ roomId: room.id, userEmail: assignEmail.trim(), warning: result.warning, message: result.message })
      } else {
        setAssignEmail('')
      }
    })
  }

  function handleAssignForce() {
    if (!pendingAssign) return
    startTransition(async () => {
      const result = await epAssignAttendee(eventId, pendingAssign.roomId, pendingAssign.userEmail, true)
      setPendingAssign(null)
      if ('error' in result) setAssignError(result.error)
      else setAssignEmail('')
    })
  }

  function handleRemoveOccupant(userId: string) {
    doAction(() => epRemoveAttendee(eventId, room.id, userId))
  }

  const occupiedCount = room.occupants.length
  const openSlots = room.bed_spot_count - room.blocked_beds.length - occupiedCount
  const statusColor = room.blocked ? '#ef4444' : room.reserved ? '#f59e0b' : '#10b981'
  const statusLabel = room.blocked ? 'BLOCKED' : room.reserved ? 'RESERVED' : 'OPEN'

  return (
    <div style={{
      background: 'var(--sd-card)',
      border: `1px solid ${room.blocked ? '#fca5a5' : room.reserved ? '#fcd34d' : 'var(--sd-border)'}`,
      borderRadius: 'var(--sd-radius)',
      padding: '16px 18px',
      opacity: room.blocked ? 0.85 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>
            {room.name}{room.number ? ` · ${room.number}` : ''}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
            {[room.lodging_type, room.bed_type].filter(Boolean).join(' · ')}
            {' '}{room.min_occupancy}–{room.bed_spot_count} occupants
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
          background: room.blocked ? '#fee2e2' : room.reserved ? '#fef3c7' : '#d1fae5',
          color: statusColor, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Occupant slots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {Array.from({ length: room.bed_spot_count }, (_, i) => {
          const bedNum = i + 1
          const isBedBlocked = room.blocked_beds.includes(bedNum)
          const occupant = room.occupants[i]
          if (isBedBlocked) {
            return (
              <span key={bedNum} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#f3f4f6', color: '#9ca3af', fontStyle: 'italic' }}>
                Bed {bedNum}: Blocked
              </span>
            )
          }
          if (occupant) {
            return (
              <span key={bedNum} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#ede9fe', color: '#5b21b6' }}>
                {occupant.is_room_lead ? '★ ' : ''}{occupant.display_name}
                {occupant.placed_via_code && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#7c3aed' }}>via code</span>}
              </span>
            )
          }
          return (
            <span key={bedNum} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#fef9c3', color: '#92400e' }}>
              OPEN
            </span>
          )
        })}
      </div>

      {/* Stats row */}
      <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '12px' }}>
        {occupiedCount} occupied · {openSlots > 0 ? openSlots : 0} open · {room.blocked_beds.length} beds blocked
      </div>

      {/* Action error */}
      {actionError && (
        <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginBottom: '8px' }}>{actionError}</p>
      )}

      {/* Block / Reserve actions — grid keeps inputs and buttons column-aligned */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 92px',
        columnGap: '6px',
        rowGap: '5px',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        {/* Block row */}
        <input
          value={blockNote}
          onChange={e => setBlockNote(e.target.value)}
          readOnly={room.blocked}
          placeholder={room.blocked ? 'No block note' : 'Block note (optional)'}
          style={{
            padding: '5px 9px', borderRadius: '6px', fontSize: '12px', width: '100%', boxSizing: 'border-box',
            border: '1px solid var(--sd-border)',
            color: room.blocked ? 'var(--sd-muted)' : 'var(--sd-text)',
            background: room.blocked ? 'var(--sd-bg)' : 'var(--sd-card)',
            cursor: room.blocked ? 'default' : 'text',
          }}
        />
        {!room.blocked ? (
          <button
            onClick={handleBlock}
            disabled={isPending}
            style={{ width: '100%', padding: '5px 0', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Block Room
          </button>
        ) : (
          <button
            onClick={handleUnblock}
            disabled={isPending}
            style={{ width: '100%', padding: '5px 0', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-purple)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Unblock
          </button>
        )}

        {/* Reserve row */}
        <input
          value={reserveNote}
          onChange={e => setReserveNote(e.target.value)}
          readOnly={room.reserved}
          placeholder={room.reserved ? 'No reserve note' : 'Reserve note (optional)'}
          style={{
            padding: '5px 9px', borderRadius: '6px', fontSize: '12px', width: '100%', boxSizing: 'border-box',
            border: '1px solid var(--sd-border)',
            color: room.reserved ? 'var(--sd-muted)' : 'var(--sd-text)',
            background: room.reserved ? 'var(--sd-bg)' : 'var(--sd-card)',
            cursor: room.reserved ? 'default' : 'text',
          }}
        />
        {!room.reserved ? (
          <button
            onClick={handleReserve}
            disabled={isPending}
            style={{ width: '100%', padding: '5px 0', borderRadius: '6px', border: 'none', background: '#f59e0b', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Reserve
          </button>
        ) : (
          <button
            onClick={handleUnreserve}
            disabled={isPending}
            style={{ width: '100%', padding: '5px 0', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-purple)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Unreserve
          </button>
        )}

        {/* Checkbox — always visible */}
        <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--sd-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={reserveNotePublic} onChange={e => handleNotePublicChange(e.target.checked)} />
          Show reserve note to users
        </label>
      </div>

      {/* Manage Beds toggle */}
      <button
        onClick={() => setExpandBeds(p => !p)}
        style={{ fontSize: '12px', color: 'var(--sd-purple)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'block', marginBottom: '4px' }}
      >
        {expandBeds ? '▾' : '▸'} Manage Beds
      </button>
      {expandBeds && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', padding: '10px', background: 'var(--sd-bg)', borderRadius: '6px' }}>
          {Array.from({ length: room.bed_spot_count }, (_, i) => {
            const bedNum = i + 1
            const isBlocked = room.blocked_beds.includes(bedNum)
            return (
              <div key={bedNum} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--sd-muted)', minWidth: '44px' }}>Bed {bedNum}</span>
                {isBlocked ? (
                  <button
                    onClick={() => handleUnblockBed(bedNum)}
                    disabled={isPending}
                    style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-purple)', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlockBed(bedNum)}
                    disabled={isPending}
                    style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Block
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Manage Occupants toggle */}
      <button
        onClick={() => setExpandOccupants(p => !p)}
        style={{ fontSize: '12px', color: 'var(--sd-purple)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'block', marginBottom: '4px' }}
      >
        {expandOccupants ? '▾' : '▸'} Manage Occupants
      </button>
      {expandOccupants && (
        <div style={{ padding: '10px', background: 'var(--sd-bg)', borderRadius: '6px' }}>
          {room.occupants.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '10px' }}>No occupants assigned.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {room.occupants.map(o => (
                <div key={o.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--sd-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {o.is_room_lead ? '★ ' : ''}{o.display_name}
                    {o.placed_via_code && <span style={{ fontSize: '11px', color: 'var(--sd-muted)' }}>via code</span>}
                    {o.room_lead_locked ? (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '99px', background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }}>Locked</span>
                    ) : o.user_locked ? (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '99px', background: 'var(--sd-blue-light)', color: '#1e40af' }}>Self-locked</span>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '99px', background: '#F3F4F6', color: '#6B7280' }}>Unlocked</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveOccupant(o.user_id)}
                    disabled={isPending}
                    style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid #fca5a5', background: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Lock / Unlock room occupancy */}
          {room.occupants.length > 0 && (
            <div style={{ marginBottom: '10px', paddingTop: '8px', borderTop: '1px solid var(--sd-border)' }}>
              {allOccupantsLocked ? (
                <button
                  onClick={handleUnlockRoom}
                  disabled={isPending}
                  style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: '#fff', color: 'var(--sd-text)', fontSize: '12px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
                >
                  Unlock All Occupants
                </button>
              ) : (
                <button
                  onClick={handleLockRoom}
                  disabled={isPending}
                  style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: isPending ? 'var(--sd-muted)' : 'var(--sd-purple)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
                >
                  Lock All Occupants
                </button>
              )}
            </div>
          )}

          {/* Assign attendee */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              value={assignEmail}
              onChange={e => { setAssignEmail(e.target.value); setAssignError('') }}
              placeholder="Assign by email…"
              type="email"
              style={{ flex: 1, minWidth: '180px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${assignError ? 'var(--sd-red)' : 'var(--sd-border)'}`, fontSize: '13px', color: 'var(--sd-text)', background: '#fff' }}
            />
            <button
              onClick={handleAssignSubmit}
              disabled={!assignEmail.trim() || isPending}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: !assignEmail.trim() || isPending ? '#E5E7EB' : 'var(--sd-purple)', color: !assignEmail.trim() || isPending ? 'var(--sd-muted)' : '#fff', fontSize: '12px', fontWeight: 600, cursor: !assignEmail.trim() || isPending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
            >
              Assign
            </button>
          </div>
          {assignError && (
            <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '6px', marginBottom: 0 }}>{assignError}</p>
          )}
        </div>
      )}

      {/* Warning modal */}
      {pendingAssign && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: 'var(--sd-card)', borderRadius: '10px', padding: '24px 28px',
            maxWidth: '400px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '10px' }}>
              Warning
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--sd-text)', marginBottom: '20px' }}>
              {pendingAssign.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingAssign(null)}
                style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignForce}
                disabled={isPending}
                style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export default function EpRoomDashboardClient({ eventId, rooms, stats }: Props) {
  const statPills: Array<{ label: string; value: number; bg: string; color: string }> = [
    { label: 'Total', value: stats.total, bg: '#f3f4f6', color: '#374151' },
    { label: 'Blocked', value: stats.blocked, bg: '#fee2e2', color: '#991b1b' },
    { label: 'Reserved', value: stats.reserved, bg: '#fef3c7', color: '#92400e' },
    { label: 'Occupied', value: stats.occupied, bg: '#ede9fe', color: '#5b21b6' },
    { label: 'Open', value: stats.open, bg: '#d1fae5', color: '#065f46' },
  ]

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        {statPills.map(p => (
          <div key={p.label} style={{ padding: '6px 14px', borderRadius: '20px', background: p.bg, color: p.color, fontSize: '12px', fontWeight: 700 }}>
            {p.value} {p.label}
          </div>
        ))}
      </div>

      {rooms.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
          No rooms are configured for this event yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {rooms.map(room => (
            <RoomManageCard key={room.id} room={room} eventId={eventId} />
          ))}
        </div>
      )}
    </div>
  )
}
