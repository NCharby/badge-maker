'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import RoomCard from './RoomCard'
import type { RoomFinderCard, MyApplication, AttendeeRoomState, RoomLockRequest } from './actions'
import { useRoommateCode, userSelfLock, acceptLockRequest, declineLockRequest, roomLeadSendLockRequest } from './actions'

interface RoomFinderClientProps {
  eventId: string
  eventTitle: string
  rooms: RoomFinderCard[]
  attendee: AttendeeRoomState
  myApplications: MyApplication[]
  lockInDate: string | null
  hasRoommateCodeFeature: boolean
  eventStartDate: string
  eventEndDate: string
  pendingLockRequests: RoomLockRequest[]
  roomLockingConfig: { room_lead_can_lock: boolean; room_lead_can_lock_with_open_spots: boolean }
}

export default function RoomFinderClient({
  eventId,
  eventTitle,
  rooms,
  attendee,
  myApplications,
  lockInDate,
  hasRoommateCodeFeature,
  eventStartDate,
  eventEndDate,
  pendingLockRequests,
  roomLockingConfig,
}: RoomFinderClientProps) {
  const router = useRouter()
  const [openSpotsOnly, setOpenSpotsOnly] = useState(false)
  const [lodgingTypeFilter, setLodgingTypeFilter] = useState('')
  const [locationZoneFilter, setLocationZoneFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Roommate Code panel state (shown to non-Room-Leads with no room)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeSuccess, setCodeSuccess] = useState<{ name: string; number: string | null; lodging_type: string | null } | null>(null)
  const [isCodePending, startCodeTransition] = useTransition()

  const showCodePanel = hasRoommateCodeFeature && !attendee.is_room_lead && !attendee.room_id && attendee.lock_status !== 'Locked'

  function handleApplyCode() {
    if (!codeInput.trim()) return
    setCodeError('')
    setCodeSuccess(null)
    startCodeTransition(async () => {
      const result = await useRoommateCode(eventId, codeInput.trim())
      if ('error' in result) {
        if (result.reason === 'room_not_selected') {
          setCodeError('Your Room Lead has not selected a room yet. Try again after they choose one, or contact your Room Lead directly.')
        } else if (result.reason === 'room_full') {
          setCodeError('This room is currently full.')
        } else {
          setCodeError(result.error)
        }
      } else {
        setCodeSuccess(result.room)
        router.refresh()
      }
    })
  }

  // Lock-related state
  const [isLockPending, startLockTransition] = useTransition()
  const [lockError, setLockError] = useState('')
  const [isLockRequestPending, startLockRequestTransition] = useTransition()
  const [lockRequestError, setLockRequestError] = useState('')
  const [lockRequestSent, setLockRequestSent] = useState(false)
  const [resolvedLockRequests, setResolvedLockRequests] = useState<Set<string>>(new Set())

  function handleSelfLock() {
    setLockError('')
    startLockTransition(async () => {
      const result = await userSelfLock(eventId)
      if (result && 'error' in result) setLockError(result.error || '')
      else router.refresh()
    })
  }

  function handleAcceptLockRequest(requestId: string) {
    startLockTransition(async () => {
      const result = await acceptLockRequest(requestId, eventId)
      if (result && 'error' in result) setLockError(result.error || '')
      else {
        setResolvedLockRequests(prev => new Set(prev).add(requestId))
        router.refresh()
      }
    })
  }

  function handleDeclineLockRequest(requestId: string) {
    startLockTransition(async () => {
      const result = await declineLockRequest(requestId, eventId)
      if (result && 'error' in result) setLockError(result.error || '')
      else {
        setResolvedLockRequests(prev => new Set(prev).add(requestId))
        router.refresh()
      }
    })
  }

  function handleSendLockRequest() {
    setLockRequestError('')
    startLockRequestTransition(async () => {
      const result = await roomLeadSendLockRequest(eventId)
      if (result && 'error' in result) setLockRequestError(result.error || '')
      else { setLockRequestSent(true); router.refresh() }
    })
  }

  // Suppress unused warning — eventTitle is a prop that may be used by parent consumers
  void eventTitle

  const lodgingTypes = Array.from(new Set(rooms.map(r => r.lodging_type).filter(Boolean))) as string[]
  const locationZones = Array.from(new Set(rooms.map(r => r.location_zone).filter(Boolean))) as string[]

  // When user is locked to a room, only show their room
  const userIsLocked = attendee.room_id && (attendee.room_lead_locked || attendee.user_locked)

  const filteredRooms = userIsLocked
    ? rooms.filter(room => room.room_id === attendee.room_id)
    : rooms.filter(room => {
        if (openSpotsOnly && room.open_spot_count === 0) return false
        if (lodgingTypeFilter && room.lodging_type !== lodgingTypeFilter) return false
        if (locationZoneFilter && room.location_zone !== locationZoneFilter) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          if (!room.room_name.toLowerCase().includes(q) && !room.room_number?.toLowerCase().includes(q)) return false
        }
        return true
      })

  const lockDeadline = lockInDate
    ? new Date(lockInDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div>
      {/* Lock-in deadline */}
      {lockDeadline && attendee.room_status !== 'Locked In' && attendee.lock_status !== 'Locked' && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#92400e',
        }}>
          Room lock-in deadline: <strong>{lockDeadline}</strong>
        </div>
      )}

      {/* Locked banner */}
      {attendee.lock_status === 'Locked' && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--sd-muted)',
        }}>
          Your room selection is locked. No further changes can be made.
        </div>
      )}

      {/* Pending lock requests */}
      {pendingLockRequests.filter(r => !resolvedLockRequests.has(r.id)).length > 0 && (
        <div style={{
          background: 'var(--sd-amber-light)',
          border: '1px solid #FCD34D',
          borderRadius: 'var(--sd-radius)',
          padding: '14px 16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
            Room Lock Request
          </div>
          <p style={{ fontSize: '13px', color: '#92400e', marginBottom: '12px', marginTop: 0 }}>
            Your Room Lead has requested that you lock in to your room. Accept to confirm your spot, or decline to leave the room.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {pendingLockRequests.filter(r => !resolvedLockRequests.has(r.id)).map(req => (
              <div key={req.id} style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAcceptLockRequest(req.id)}
                  disabled={isLockPending}
                  style={{
                    padding: '7px 16px', borderRadius: '6px', border: 'none',
                    background: 'var(--sd-green)', color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: isLockPending ? 'not-allowed' : 'pointer', opacity: isLockPending ? 0.6 : 1,
                  }}
                >
                  Accept &amp; Lock In
                </button>
                <button
                  onClick={() => handleDeclineLockRequest(req.id)}
                  disabled={isLockPending}
                  style={{
                    padding: '7px 16px', borderRadius: '6px',
                    border: '1px solid #92400e', background: 'transparent', color: '#92400e',
                    fontSize: '13px', fontWeight: 600,
                    cursor: isLockPending ? 'not-allowed' : 'pointer', opacity: isLockPending ? 0.6 : 1,
                  }}
                >
                  Decline &amp; Leave Room
                </button>
              </div>
            ))}
          </div>
          {lockError && <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '8px', marginBottom: 0 }}>{lockError}</p>}
        </div>
      )}

      {/* User self-lock button (non-RL with a selected room, not yet locked) */}
      {attendee.room_id && attendee.room_status === 'Selected' && !attendee.user_locked && !attendee.is_room_lead && attendee.lock_status !== 'Locked' && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>Lock yourself to this room</div>
            <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
              Indicates to your Room Lead that you intend to stay. Your Room Lead or EP can still move you if needed.
            </div>
          </div>
          <button
            onClick={handleSelfLock}
            disabled={isLockPending}
            style={{
              padding: '7px 16px', borderRadius: '6px', border: 'none', whiteSpace: 'nowrap',
              background: isLockPending ? 'var(--sd-muted)' : 'var(--sd-green)', color: '#fff',
              fontSize: '13px', fontWeight: 600,
              cursor: isLockPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isLockPending ? 'Locking...' : 'Lock In'}
          </button>
        </div>
      )}

      {/* User locked confirmation */}
      {attendee.user_locked && !attendee.room_lead_locked && attendee.room_id && (
        <div style={{
          background: 'var(--sd-blue-light)',
          border: '1px solid var(--sd-blue)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',

          fontSize: '13px',
          color: '#1e40af',
        }}>
          You are locked to your room. Awaiting confirmation.
        </div>
      )}

      {/* Room Lead locked confirmation */}
      {attendee.room_lead_locked && attendee.room_id && (
        <div style={{
          background: 'var(--sd-green-light)',
          border: '1px solid var(--sd-green)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--sd-green-dark)',
        }}>
          Your room is fully locked and confirmed.
        </div>
      )}

      {/* Room Lead: Send Lock Request button */}
      {attendee.is_room_lead && attendee.room_id && roomLockingConfig.room_lead_can_lock && attendee.lock_status !== 'Locked' && !attendee.room_lead_locked && !lockRequestSent && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>Lock your room</div>
            <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
              Send a lock request to all occupants. They can accept to lock in, or decline and leave.
            </div>
          </div>
          <button
            onClick={handleSendLockRequest}
            disabled={isLockRequestPending}
            style={{
              padding: '7px 16px', borderRadius: '6px', border: 'none', whiteSpace: 'nowrap',
              background: isLockRequestPending ? 'var(--sd-muted)' : 'var(--sd-green)', color: '#fff',
              fontSize: '13px', fontWeight: 600,
              cursor: isLockRequestPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isLockRequestPending ? 'Sending...' : 'Send Lock Request'}
          </button>
        </div>
      )}
      {lockRequestSent && (
        <div style={{
          background: 'var(--sd-green-light)',
          border: '1px solid var(--sd-green)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--sd-green-dark)',
        }}>
          Lock requests sent to your roommates.
        </div>
      )}
      {lockRequestError && (
        <div style={{
          background: 'var(--sd-red-light)',
          border: '1px solid var(--sd-red)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--sd-red)',
        }}>
          {lockRequestError}
        </div>
      )}

      {/* Room Lead: Roommate Code display */}
      {attendee.is_room_lead && attendee.roommate_code && (
        <div style={{
          background: '#d1fae5',
          border: '1px solid #6ee7b7',
          borderRadius: 'var(--sd-radius)',
          padding: '12px 16px',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Your Roommate Code
          </span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#064e3b', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
            {attendee.roommate_code}
          </span>
          <span style={{ fontSize: '12px', color: '#065f46', display: 'block', marginTop: '4px' }}>
            Share this with people you want in your room.
          </span>
        </div>
      )}

      {/* Non-Room-Lead: Roommate Code entry panel */}
      {showCodePanel && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '16px 20px',
          marginBottom: '20px',
        }}>
          {codeSuccess ? (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--sd-green-dark)', marginBottom: '4px' }}>
                Room assigned via Roommate Code
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sd-text)' }}>
                {codeSuccess.name}{codeSuccess.number ? ` · Room ${codeSuccess.number}` : ''}
                {codeSuccess.lodging_type && <span style={{ color: 'var(--sd-muted)' }}> — {codeSuccess.lodging_type}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
                Refreshing your room status…
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)', marginBottom: '6px' }}>
                Have a Roommate Code?
              </div>
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '10px', marginTop: 0 }}>
                Enter a 6-character code from your Room Lead to reserve a spot in their room.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <input
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
                  placeholder="e.g. X3K9R7"
                  maxLength={6}
                  disabled={isCodePending}
                  style={{
                    width: '140px',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${codeError ? 'var(--sd-red)' : 'var(--sd-border)'}`,
                    fontSize: '15px',
                    fontFamily: 'monospace',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--sd-text)',
                    background: '#fff',
                  }}
                />
                <button
                  onClick={handleApplyCode}
                  disabled={codeInput.trim().length !== 6 || isCodePending}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: codeInput.trim().length !== 6 || isCodePending ? '#E5E7EB' : 'var(--sd-green)',
                    color: codeInput.trim().length !== 6 || isCodePending ? 'var(--sd-muted)' : '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: codeInput.trim().length !== 6 || isCodePending ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCodePending ? 'Applying…' : 'Apply Code'}
                </button>
              </div>
              {codeError && (
                <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '6px', marginBottom: 0 }}>
                  {codeError}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Filter bar — hidden when user is locked to a room */}
      {!userIsLocked && <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={openSpotsOnly}
            onChange={e => setOpenSpotsOnly(e.target.checked)}
          />
          Open spots only
        </label>

        {lodgingTypes.length > 0 && (
          <select
            value={lodgingTypeFilter}
            onChange={e => setLodgingTypeFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'var(--sd-card)', color: 'var(--sd-text)' }}
          >
            <option value="">All types</option>
            {lodgingTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {locationZones.length > 0 && (
          <select
            value={locationZoneFilter}
            onChange={e => setLocationZoneFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'var(--sd-card)', color: 'var(--sd-text)' }}
          >
            <option value="">All zones</option>
            {locationZones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        )}

        <input
          type="text"
          placeholder="Search room name or number…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ fontSize: '13px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'var(--sd-card)', color: 'var(--sd-text)', minWidth: '200px' }}
        />
      </div>}

      {/* Empty states */}
      {rooms.length === 0 && (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          Room selection is not yet available for this event.
        </p>
      )}
      {rooms.length > 0 && filteredRooms.length === 0 && (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          No rooms match your filters.
        </p>
      )}

      {/* Room grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {filteredRooms.map(room => (
          <RoomCard
            key={room.room_id}
            room={room}
            eventId={eventId}
            attendee={attendee}
            myApplications={myApplications}
            eventStartDate={eventStartDate}
            eventEndDate={eventEndDate}
          />
        ))}
      </div>
    </div>
  )
}
