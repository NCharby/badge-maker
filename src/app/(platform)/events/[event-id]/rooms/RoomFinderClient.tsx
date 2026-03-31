'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import RoomCard from './RoomCard'
import type { RoomFinderCard, MyApplication, AttendeeRoomState } from './actions'
import { useRoommateCode } from './actions'

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

  // Suppress unused warning — eventTitle is a prop that may be used by parent consumers
  void eventTitle

  const lodgingTypes = Array.from(new Set(rooms.map(r => r.lodging_type).filter(Boolean))) as string[]
  const locationZones = Array.from(new Set(rooms.map(r => r.location_zone).filter(Boolean))) as string[]

  const filteredRooms = rooms.filter(room => {
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

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
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
      </div>

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
