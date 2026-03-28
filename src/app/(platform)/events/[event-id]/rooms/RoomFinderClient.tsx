'use client'

import { useState } from 'react'
import RoomCard from './RoomCard'
import type { RoomFinderCard, MyApplication, AttendeeRoomState } from './actions'

interface RoomFinderClientProps {
  eventId: string
  eventTitle: string
  rooms: RoomFinderCard[]
  attendee: AttendeeRoomState
  myApplications: MyApplication[]
  lockInDate: string | null
}

export default function RoomFinderClient({
  eventId,
  eventTitle,
  rooms,
  attendee,
  myApplications,
  lockInDate,
}: RoomFinderClientProps) {
  const [openSpotsOnly, setOpenSpotsOnly] = useState(false)
  const [lodgingTypeFilter, setLodgingTypeFilter] = useState('')
  const [locationZoneFilter, setLocationZoneFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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
    ? new Date(lockInDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

      {/* Room Lead: Roommate Code */}
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
          />
        ))}
      </div>
    </div>
  )
}
