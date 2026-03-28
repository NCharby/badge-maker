'use client'

import { useState, useTransition } from 'react'
import { claimRoommateByEmail, acceptApplication, declineApplication } from '../actions'
import type { AttendeeRoomState } from '../actions'

type RoomData = {
  id: string
  name: string
  number: string | null
  lodging_type: string | null
  bed_type: string | null
  has_kitchen: boolean
  location_zone: string | null
  bed_spot_count: number
  min_occupancy: number
  room_daily_rates: Array<{ date: string; amount: number }> | null
  room_code: string | null
}

type ResolvedOccupant = {
  userId: string
  displayName: string
  isRoomLead: boolean
  roomStatus: string
}

type ResolvedApplication = {
  id: string
  applicant_user_id: string
  initiated_by: 'room_lead' | 'roommate'
  created_at: string
  status: string
  display_name: string
  social_media: unknown | null
}

interface RoomDetailClientProps {
  eventId: string
  room: RoomData
  attendee: AttendeeRoomState
  occupants: ResolvedOccupant[]
  pendingApplications: ResolvedApplication[]
  isMyRoom: boolean
}

export default function RoomDetailClient({
  eventId,
  room,
  attendee,
  occupants,
  pendingApplications,
  isMyRoom,
}: RoomDetailClientProps) {
  // Claim by email
  const [claimEmail, setClaimEmail] = useState('')
  const [claimPending, startClaimTransition] = useTransition()
  const [claimError, setClaimError] = useState<string | null>(null)
  const [claimSuccess, setClaimSuccess] = useState(false)

  // Applications
  const [appPending, startAppTransition] = useTransition()
  const [appErrors, setAppErrors] = useState<Record<string, string>>({})
  const [resolvedApps, setResolvedApps] = useState<Set<string>>(new Set())

  const totalNightly = room.room_daily_rates && room.room_daily_rates.length > 0
    ? room.room_daily_rates.reduce((sum, r) => sum + r.amount, 0)
    : null

  // Occupant slots: bed_spot_count slots total; Room Lead always first
  const sortedOccupants = [...occupants].sort((a, b) => (b.isRoomLead ? 1 : 0) - (a.isRoomLead ? 1 : 0))
  const slots = Array.from({ length: room.bed_spot_count }, (_, i) => {
    const occ = sortedOccupants[i]
    return occ
      ? { display: occ.displayName, isLead: occ.isRoomLead, status: occ.roomStatus }
      : { display: 'OPEN', isLead: false, status: 'open' }
  })

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault()
    setClaimError(null)
    setClaimSuccess(false)
    startClaimTransition(async () => {
      const result = await claimRoommateByEmail(eventId, room.id, claimEmail.trim())
      if (result?.error) {
        setClaimError(result.error)
      } else {
        setClaimSuccess(true)
        setClaimEmail('')
      }
    })
  }

  const handleAccept = (appId: string) => {
    startAppTransition(async () => {
      const result = await acceptApplication(appId, eventId)
      if (result?.error) {
        setAppErrors(prev => ({ ...prev, [appId]: result.error! }))
      } else {
        setResolvedApps(prev => new Set(prev).add(appId))
      }
    })
  }

  const handleDecline = (appId: string) => {
    startAppTransition(async () => {
      const result = await declineApplication(appId, eventId)
      if (result?.error) {
        setAppErrors(prev => ({ ...prev, [appId]: result.error! }))
      } else {
        setResolvedApps(prev => new Set(prev).add(appId))
      }
    })
  }

  const visibleApps = pendingApplications.filter(app => !resolvedApps.has(app.id))

  return (
    <div>
      {/* Room header */}
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        {room.name}
      </h1>
      {room.number && (
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '16px' }}>
          Room #{room.number}
        </p>
      )}

      {/* Room info card */}
      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
          {room.lodging_type && (
            <div>
              <span style={{ color: 'var(--sd-muted)' }}>Type</span>
              <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{room.lodging_type}</div>
            </div>
          )}
          {room.bed_type && (
            <div>
              <span style={{ color: 'var(--sd-muted)' }}>Bed</span>
              <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{room.bed_type}</div>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--sd-muted)' }}>Occupancy</span>
            <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{room.min_occupancy}–{room.bed_spot_count} guests</div>
          </div>
          {room.location_zone && (
            <div>
              <span style={{ color: 'var(--sd-muted)' }}>Zone</span>
              <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>{room.location_zone}</div>
            </div>
          )}
          {room.has_kitchen && (
            <div>
              <span style={{ color: 'var(--sd-muted)' }}>Kitchen</span>
              <div style={{ fontWeight: 600, color: 'var(--sd-text)' }}>Yes</div>
            </div>
          )}
          {/* Room code — only visible to confirmed occupants */}
          {isMyRoom && room.room_code && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--sd-muted)' }}>Room Code <span style={{ fontSize: '11px' }}>(present at hotel check-in)</span></span>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '16px', color: 'var(--sd-text)', letterSpacing: '0.08em', marginTop: '2px' }}>
                {room.room_code}
              </div>
            </div>
          )}
        </div>

        {/* Nightly pricing */}
        {room.room_daily_rates && room.room_daily_rates.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--sd-border)', fontSize: '13px' }}>
            <div style={{ color: 'var(--sd-muted)', marginBottom: '6px' }}>Nightly rates (paid directly to hotel)</div>
            {room.room_daily_rates.map(r => (
              <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span>${r.amount.toFixed(2)}</span>
              </div>
            ))}
            {totalNightly !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--sd-border)' }}>
                <span>Total</span>
                <span>${totalNightly.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Occupant slots */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
        Bed Spots ({occupants.length}/{room.bed_spot_count} filled)
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        {slots.map((slot, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              background: slot.display === 'OPEN' ? '#fef3c7' : 'var(--sd-card)',
              border: `1px solid ${slot.display === 'OPEN' ? '#fcd34d' : 'var(--sd-border)'}`,
              fontSize: '13px',
              fontWeight: slot.display === 'OPEN' ? 600 : 400,
              color: slot.display === 'OPEN' ? '#92400e' : 'var(--sd-text)',
            }}
          >
            {slot.isLead && <span style={{ fontSize: '11px', color: 'var(--sd-green)', fontWeight: 700, marginRight: '4px' }}>RL</span>}
            {slot.display}
          </div>
        ))}
      </div>

      {/* Room Lead: Find a Roommate panel */}
      {isMyRoom && attendee.is_room_lead && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Find a Roommate
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '12px' }}>
            Invite an attendee by email address. They must have a completed ticket and no room selected.
          </p>
          <form onSubmit={handleClaim}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={claimEmail}
                onChange={e => setClaimEmail(e.target.value)}
                placeholder="attendee@example.com"
                required
                style={{
                  flex: 1,
                  minWidth: '200px',
                  fontSize: '13px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--sd-border)',
                  background: 'var(--sd-card)',
                  color: 'var(--sd-text)',
                }}
              />
              <button
                type="submit"
                disabled={claimPending}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '7px 16px',
                  background: 'var(--sd-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: claimPending ? 'not-allowed' : 'pointer',
                  opacity: claimPending ? 0.7 : 1,
                }}
              >
                {claimPending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
            {claimError && (
              <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                {claimError}
              </p>
            )}
            {claimSuccess && (
              <p style={{ color: '#065f46', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                Invitation sent.
              </p>
            )}
          </form>
        </div>
      )}

      {/* Room Lead: Pending applications */}
      {isMyRoom && attendee.is_room_lead && (
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>
            Pending Applications
          </h2>

          {visibleApps.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No pending applications.</p>
          )}

          {visibleApps.map(app => {
            const socialMedia = app.social_media as Array<{ key: string; value: string }> | null
            return (
              <div
                key={app.id}
                style={{
                  background: 'var(--sd-card)',
                  border: '1px solid var(--sd-border)',
                  borderRadius: 'var(--sd-radius)',
                  padding: '14px 16px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)' }}>
                  {app.display_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '8px' }}>
                  {app.initiated_by === 'roommate' ? 'Requested a spot' : 'Invited by you'}
                  {' · '}
                  {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>

                {/* Social media links (if not hidden) */}
                {socialMedia && socialMedia.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {socialMedia.map((sm, idx) => (
                      sm.value ? (
                        <span
                          key={idx}
                          style={{
                            fontSize: '11px',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: 'var(--sd-text)',
                          }}
                        >
                          {sm.key}: {sm.value}
                        </span>
                      ) : null
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAccept(app.id)}
                    disabled={appPending}
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      background: 'var(--sd-green)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: appPending ? 'not-allowed' : 'pointer',
                      opacity: appPending ? 0.7 : 1,
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(app.id)}
                    disabled={appPending}
                    style={{
                      fontSize: '13px',
                      color: 'var(--sd-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: appPending ? 'not-allowed' : 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Decline
                  </button>
                </div>

                {appErrors[app.id] && (
                  <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                    {appErrors[app.id]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
