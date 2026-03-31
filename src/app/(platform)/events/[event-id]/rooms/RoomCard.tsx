'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { selectRoom, applyForRoom, withdrawApplication } from './actions'
import type { RoomFinderCard, MyApplication, AttendeeRoomState } from './actions'

interface RoomCardProps {
  room: RoomFinderCard
  eventId: string
  attendee: AttendeeRoomState
  myApplications: MyApplication[]
  eventStartDate: string
  eventEndDate: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function buildDayDateMap(startDate: string, endDate: string): Record<string, string> {
  const map: Record<string, string> = {}
  const current = new Date(startDate + 'T12:00:00Z')
  const end = new Date(endDate + 'T12:00:00Z')
  while (current < end) {
    map[DAY_NAMES[current.getUTCDay()]] = current.toISOString().slice(0, 10)
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return map
}

export default function RoomCard({ room, eventId, attendee, myApplications, eventStartDate, eventEndDate }: RoomCardProps) {
  const dateMap = buildDayDateMap(eventStartDate, eventEndDate)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const myAppForThisRoom = myApplications.find(a => a.room_id === room.room_id)
  const isMyCurrentRoom = attendee.room_id === room.room_id
  const isLocked = attendee.lock_status === 'Locked'
  const alreadyApplied = !!myAppForThisRoom
  const hasRoom = attendee.room_id !== null

  const totalNightly = room.room_daily_rates && room.room_daily_rates.length > 0
    ? room.room_daily_rates.reduce((sum, r) => sum + r.amount, 0)
    : null

  const canClaim = attendee.is_room_lead
    && !isLocked
    && room.room_lead_display_name === 'OPEN'
    && !isMyCurrentRoom

  const canApply = !attendee.is_room_lead
    && !isLocked
    && room.open_spot_count > 0
    && room.room_lead_display_name !== 'OPEN'
    && !alreadyApplied
    && !hasRoom

  const canWithdraw = !attendee.is_room_lead
    && !isLocked
    && alreadyApplied
    && myAppForThisRoom?.status === 'pending'

  const handleClaim = () => {
    setError(null)
    startTransition(async () => {
      const result = await selectRoom(eventId, room.room_id)
      if (result?.error) setError(result.error)
    })
  }

  const handleApply = () => {
    setError(null)
    startTransition(async () => {
      const result = await applyForRoom(eventId, room.room_id)
      if (result?.error) setError(result.error)
    })
  }

  const handleWithdraw = () => {
    setError(null)
    if (!myAppForThisRoom) return
    startTransition(async () => {
      const result = await withdrawApplication(myAppForThisRoom.id, eventId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{
      background: 'var(--sd-card)',
      border: isMyCurrentRoom ? '2px solid var(--sd-green)' : '1px solid var(--sd-border)',
      borderRadius: 'var(--sd-radius)',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      opacity: isLocked && !isMyCurrentRoom ? 0.75 : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: room.open_spot_count > 0 ? 'var(--sd-green)' : 'var(--sd-muted)',
        }}>
          {room.open_spot_count} spot{room.open_spot_count !== 1 ? 's' : ''} open
        </span>
        {isMyCurrentRoom && (
          <span style={{
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            Your room
          </span>
        )}
        {alreadyApplied && !isMyCurrentRoom && (
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            Applied
          </span>
        )}
      </div>

      {/* Room name + number */}
      <div>
        <h3 style={{ margin: '4px 0 2px', fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)' }}>
          {room.room_name}
        </h3>
        {room.room_number && (
          <p style={{ color: 'var(--sd-muted)', fontSize: '12px', margin: 0 }}>
            #{room.room_number}
          </p>
        )}
      </div>

      {/* Metadata */}
      <p style={{ fontSize: '12px', color: 'var(--sd-muted)', margin: 0 }}>
        {[
          room.lodging_type,
          room.bed_type,
          `${room.min_occupancy}–${room.max_occupancy} guests`,
          room.has_kitchen ? 'Kitchen' : null,
          room.location_zone,
        ].filter(Boolean).join(' · ')}
      </p>

      {/* Pricing */}
      {room.room_daily_rates && room.room_daily_rates.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
          {room.room_daily_rates.map(r => {
            const isoDate = dateMap[r.date]
            const label = isoDate
              ? new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
              : r.date.charAt(0).toUpperCase() + r.date.slice(1).toLowerCase()
            return (
              <div key={r.date}>
                {label}: ${r.amount.toFixed(2)}/night
              </div>
            )
          })}
          {totalNightly !== null && (
            <div style={{ fontWeight: 600, marginTop: '2px', color: 'var(--sd-text)' }}>
              Total: ${totalNightly.toFixed(2)} <span style={{ fontWeight: 400, color: 'var(--sd-muted)' }}>(paid to hotel)</span>
            </div>
          )}
        </div>
      )}

      {/* Room Lead */}
      <div style={{ fontSize: '12px' }}>
        <strong style={{ color: 'var(--sd-text)' }}>Room Lead:</strong>{' '}
        <span style={{ color: room.room_lead_display_name === 'OPEN' ? 'var(--sd-muted)' : 'var(--sd-text)' }}>
          {room.room_lead_display_name}
        </span>
      </div>

      {/* Occupant chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
        {(room.occupants ?? []).map((occ, idx) => (
          <span
            key={idx}
            style={{
              display: 'inline-block',
              background: occ.display_name === 'OPEN' ? '#fef3c7' : '#f1f5f9',
              color: occ.display_name === 'OPEN' ? '#92400e' : 'var(--sd-text)',
              borderRadius: '4px',
              padding: '2px 7px',
              fontSize: '11px',
              fontWeight: occ.display_name === 'OPEN' ? 600 : 400,
            }}
          >
            {occ.display_name}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0' }}>{error}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
        <Link
          href={`/events/${eventId}/rooms/${room.room_id}`}
          style={{ fontSize: '12px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          View details
        </Link>

        {canClaim && (
          <button
            onClick={handleClaim}
            disabled={isPending}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 14px',
              background: 'var(--sd-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Claiming…' : 'Claim Room'}
          </button>
        )}

        {canApply && (
          <button
            onClick={handleApply}
            disabled={isPending}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 14px',
              background: 'var(--sd-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Applying…' : 'Apply for Spot'}
          </button>
        )}

        {canWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={isPending}
            style={{
              fontSize: '12px',
              color: 'var(--sd-muted)',
              background: 'none',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isPending ? 'Withdrawing…' : 'Withdraw application'}
          </button>
        )}

        {isMyCurrentRoom && !isLocked && (
          <Link
            href={`/events/${eventId}/rooms/${room.room_id}`}
            style={{ fontSize: '13px', color: '#065f46', fontWeight: 600, textDecoration: 'none', marginLeft: 'auto' }}
          >
            Manage my room →
          </Link>
        )}
      </div>
    </div>
  )
}
