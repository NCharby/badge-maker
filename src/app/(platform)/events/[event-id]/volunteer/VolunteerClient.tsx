'use client'

import { useState, useTransition } from 'react'
import { signUpForShift, cancelSignup } from './actions'
import type { VolunteerSignup } from './actions'

export type ShiftRow = {
  id: string
  name: string
  date_time: string
  duration_minutes: number
  capacity: number
}

interface VolunteerClientProps {
  eventId: string
  shifts: ShiftRow[]
  mySignups: VolunteerSignup[]
  signupCounts: Record<string, number>
  hoursRequired: number
  isLocked: boolean
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function formatShiftTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function VolunteerClient({
  eventId,
  shifts,
  mySignups: initialSignups,
  signupCounts: initialCounts,
  hoursRequired,
  isLocked,
}: VolunteerClientProps) {
  const [localSignups, setLocalSignups] = useState<VolunteerSignup[]>(initialSignups)
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>(initialCounts)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const confirmedMinutes = localSignups.reduce((sum, signup) => {
    const shift = shifts.find(s => s.id === signup.shift_id)
    return sum + (shift?.duration_minutes ?? 0)
  }, 0)
  const confirmedHours = confirmedMinutes / 60
  const requirementMet = hoursRequired === 0 || confirmedMinutes >= hoursRequired * 60

  const isSignedUp = (shiftId: string) => localSignups.some(s => s.shift_id === shiftId)
  const getSignup = (shiftId: string) => localSignups.find(s => s.shift_id === shiftId)

  const handleSignUp = (shiftId: string) => {
    setErrors(prev => ({ ...prev, [shiftId]: '' }))
    startTransition(async () => {
      const result = await signUpForShift(eventId, shiftId)
      if (result?.error) {
        setErrors(prev => ({ ...prev, [shiftId]: result.error! }))
      } else if (result?.signup) {
        setLocalSignups(prev => [...prev, result.signup!])
        setSignupCounts(prev => ({ ...prev, [shiftId]: (prev[shiftId] ?? 0) + 1 }))
      }
    })
  }

  const handleCancel = (shiftId: string) => {
    const signup = getSignup(shiftId)
    if (!signup) return
    setErrors(prev => ({ ...prev, [shiftId]: '' }))
    startTransition(async () => {
      const result = await cancelSignup(signup.id, eventId)
      if (result?.error) {
        setErrors(prev => ({ ...prev, [shiftId]: result.error! }))
      } else {
        setLocalSignups(prev => prev.filter(s => s.shift_id !== shiftId))
        setSignupCounts(prev => ({ ...prev, [shiftId]: Math.max(0, (prev[shiftId] ?? 1) - 1) }))
      }
    })
  }

  return (
    <div>
      {/* Hours progress */}
      {hoursRequired > 0 ? (
        <div style={{
          background: requirementMet ? 'var(--sd-green-light)' : '#fef3c7',
          border: `1px solid ${requirementMet ? 'var(--sd-green)' : '#fcd34d'}`,
          borderRadius: 'var(--sd-radius)',
          padding: '14px 16px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: requirementMet ? 'var(--sd-green-dark)' : '#92400e' }}>
            {requirementMet
              ? `Requirement met — ${formatDuration(confirmedMinutes)} of ${formatDuration(hoursRequired * 60)} signed up`
              : `${formatDuration(confirmedMinutes)} of ${formatDuration(hoursRequired * 60)} required hours signed up`}
          </div>
          {/* Progress bar */}
          <div style={{ height: '6px', background: requirementMet ? 'rgba(0,0,0,.1)' : '#fde68a', borderRadius: '99px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round((confirmedMinutes / (hoursRequired * 60)) * 100))}%`,
              background: requirementMet ? 'var(--sd-green)' : '#f59e0b',
              borderRadius: '99px',
              transition: 'width .3s',
            }} />
          </div>
        </div>
      ) : (
        <div style={{
          background: '#F3F4F6',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '24px',
          fontSize: '13px',
          color: 'var(--sd-muted)',
        }}>
          No hours requirement for your ticket.
        </div>
      )}

      {/* Locked banner */}
      {isLocked && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--sd-muted)',
        }}>
          Your attendance is locked. No further changes can be made.
        </div>
      )}

      {/* Empty state */}
      {shifts.length === 0 && (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
          No volunteer shifts are available for this event yet.
        </p>
      )}

      {/* Shift list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {shifts.map(shift => {
          const signedUp = isSignedUp(shift.id)
          const count = signupCounts[shift.id] ?? 0
          const error = errors[shift.id]

          return (
            <div
              key={shift.id}
              style={{
                background: signedUp ? 'var(--sd-green-light)' : 'var(--sd-card)',
                border: `1px solid ${signedUp ? 'var(--sd-green)' : 'var(--sd-border)'}`,
                borderRadius: 'var(--sd-radius)',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
                    {shift.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <span>{formatShiftTime(shift.date_time)}</span>
                    <span>·</span>
                    <span>{formatDuration(shift.duration_minutes)}</span>
                    <span>·</span>
                    <span>{count} of {shift.capacity} signed up</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {signedUp && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-green-dark)', padding: '3px 10px', background: 'rgba(255,255,255,.6)', borderRadius: '99px', border: '1px solid var(--sd-green)' }}>
                      Signed up
                    </span>
                  )}

                  {!isLocked && (
                    signedUp ? (
                      <button
                        onClick={() => handleCancel(shift.id)}
                        disabled={isPending}
                        style={{
                          fontSize: '13px',
                          color: 'var(--sd-green-dark)',
                          background: 'none',
                          border: 'none',
                          cursor: isPending ? 'not-allowed' : 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          opacity: isPending ? 0.6 : 1,
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSignUp(shift.id)}
                        disabled={isPending}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          padding: '6px 16px',
                          background: 'var(--sd-green)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isPending ? 'not-allowed' : 'pointer',
                          opacity: isPending ? 0.7 : 1,
                        }}
                      >
                        Sign Up
                      </button>
                    )
                  )}
                </div>
              </div>

              {error && (
                <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
