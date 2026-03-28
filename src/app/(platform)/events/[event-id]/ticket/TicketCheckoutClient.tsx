'use client'

import { useState, useTransition } from 'react'
import { purchaseTicket } from './actions'
import { validateRoommateCode } from './validateRoommateCode'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  available_count: number | null
  room_lead: boolean
  roommate_codes_enabled: boolean
  volunteer_hours_required: number
  room_required_at_purchase: boolean
}

interface MerchandiseItem {
  id: string
  name: string
  description: string | null
  price: number
  available_count: number | null
  image_url: string | null
  ticket_type_restriction: string[] | null
}

interface VolunteerShift {
  id: string
  name: string
  date_time: string
  duration_minutes: number
  capacity: number
}

interface RoomInfo {
  roomId: string
  roomName: string
  roomNumber: string
  roomLeadName: string
  lodgingType: string | null
  nightlyTotal: number | null
}

interface Props {
  eventId: string
  ticketTypes: TicketType[]
  merchandise: MerchandiseItem[]
  volunteerShifts: VolunteerShift[]
  hasRoommateCodeFeature: boolean  // true if any Room Lead ticket type has roommate_codes_enabled
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price === 0) return 'Free'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
}

function formatShiftTime(dateTime: string): string {
  return new Date(dateTime).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function shiftsOverlapCheck(ids: string[], shifts: VolunteerShift[]): boolean {
  const selected = ids.map(id => shifts.find(s => s.id === id)).filter(Boolean) as VolunteerShift[]
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const aStart = new Date(selected[i].date_time).getTime()
      const aEnd   = aStart + selected[i].duration_minutes * 60_000
      const bStart = new Date(selected[j].date_time).getTime()
      const bEnd   = bStart + selected[j].duration_minutes * 60_000
      if (aStart < bEnd && bStart < aEnd) return true
    }
  }
  return false
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'ticket' | 'roommate_code' | 'shifts' | 'merch' | 'review' | 'success'

export default function TicketCheckoutClient({
  eventId,
  ticketTypes,
  merchandise,
  volunteerShifts,
  hasRoommateCodeFeature,
}: Props) {
  const [step, setStep] = useState<Step>('ticket')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])
  const [selectedMerchIds, setSelectedMerchIds] = useState<string[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Roommate Code step state
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [confirmedRoomCode, setConfirmedRoomCode] = useState<string | null>(null)
  const [confirmedRoomInfo, setConfirmedRoomInfo] = useState<RoomInfo | null>(null)
  const [isVerifyPending, startVerifyTransition] = useTransition()

  // Code returned to Room Lead after purchase (for success screen)
  const [purchasedRoommateCode, setPurchasedRoommateCode] = useState<string | undefined>()

  const selectedTicket = ticketTypes.find(t => t.id === selectedTicketId)

  // Merchandise items eligible for the selected ticket type
  const eligibleMerch = merchandise.filter(m => {
    if (!m.ticket_type_restriction || m.ticket_type_restriction.length === 0) return true
    return selectedTicketId !== null && m.ticket_type_restriction.includes(selectedTicketId)
  })

  // Show roommate code step when: feature is enabled AND selected ticket is NOT a Room Lead ticket
  const showRoommateCodeStep =
    hasRoommateCodeFeature && selectedTicket !== undefined && !selectedTicket.room_lead

  function getStepOrder(): Step[] {
    const steps: Step[] = ['ticket']
    if (showRoommateCodeStep) steps.push('roommate_code')
    if (selectedTicket && selectedTicket.volunteer_hours_required > 0) steps.push('shifts')
    if (eligibleMerch.length > 0) steps.push('merch')
    steps.push('review')
    return steps
  }

  function nextStep() {
    setError('')
    const steps = getStepOrder()
    const currentIdx = steps.indexOf(step)
    if (currentIdx < steps.length - 1) setStep(steps[currentIdx + 1])
  }

  function prevStep() {
    setError('')
    const steps = getStepOrder()
    const currentIdx = steps.indexOf(step)
    if (currentIdx > 0) setStep(steps[currentIdx - 1])
  }

  // Hours tracking for shift selection
  const selectedMinutes = selectedShiftIds.reduce((sum, id) => {
    const s = volunteerShifts.find(v => v.id === id)
    return sum + (s?.duration_minutes ?? 0)
  }, 0)
  const requiredMinutes = (selectedTicket?.volunteer_hours_required ?? 0) * 60
  const hoursOk = selectedMinutes >= requiredMinutes
  const hasOverlap = shiftsOverlapCheck(selectedShiftIds, volunteerShifts)

  function toggleShift(id: string) {
    setSelectedShiftIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function toggleMerch(id: string) {
    setSelectedMerchIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  function handleVerifyCode() {
    if (!codeInput.trim()) return
    setCodeError('')
    setConfirmedRoomInfo(null)
    startVerifyTransition(async () => {
      const result = await validateRoommateCode(eventId, codeInput.trim())
      if (!result.valid) {
        if (result.reason === 'room_not_selected') {
          setCodeError('Your Room Lead has not selected a room yet. Skip this step and try again later, or contact your Room Lead directly.')
        } else if (result.reason === 'room_full') {
          setCodeError('This room is currently full.')
        } else {
          setCodeError('This code is not valid.')
        }
      } else {
        setConfirmedRoomInfo({
          roomId: result.roomId,
          roomName: result.roomName,
          roomNumber: result.roomNumber,
          roomLeadName: result.roomLeadName,
          lodgingType: result.lodgingType,
          nightlyTotal: result.nightlyTotal,
        })
      }
    })
  }

  function handleConfirmRoom() {
    if (!confirmedRoomInfo) return
    setConfirmedRoomCode(codeInput.trim().toUpperCase())
    nextStep()
  }

  function handleSkipCode() {
    setCodeInput('')
    setCodeError('')
    setConfirmedRoomInfo(null)
    setConfirmedRoomCode(null)
    nextStep()
  }

  function handleConfirm() {
    if (!selectedTicketId) return
    setError('')
    startTransition(async () => {
      const result = await purchaseTicket(
        eventId,
        selectedTicketId,
        selectedShiftIds,
        selectedMerchIds,
        confirmedRoomCode ?? undefined,
      )
      if ('error' in result) {
        setError(result.error)
      } else {
        setOrderId(result.orderId)
        setPurchasedRoommateCode(result.roommate_code)
        setStep('success')
      }
    })
  }

  // ── Total ─────────────────────────────────────────────────────────────────────
  const selectedMerchItems = selectedMerchIds.map(id => eligibleMerch.find(m => m.id === id)).filter(Boolean) as MerchandiseItem[]
  const total = (selectedTicket ? Number(selectedTicket.price) : 0) + selectedMerchItems.reduce((s, m) => s + Number(m.price), 0)

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (ticketTypes.length === 0) {
    return (
      <div style={{ padding: '24px', background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', color: 'var(--sd-muted)', fontSize: '14px' }}>
        No ticket types are available for this event.
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎟</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '8px' }}>
          You&apos;re registered!
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '4px' }}>
          {selectedTicket?.name}
        </p>
        {orderId && (
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
            Order #{orderId.slice(0, 8)}
          </p>
        )}

        {/* Roommate Code display for Room Leads */}
        {purchasedRoommateCode && (
          <div style={{ marginTop: '24px', padding: '16px 20px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', textAlign: 'left' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Your Roommate Code
            </p>
            <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.15em', color: '#065f46', fontFamily: 'monospace', marginBottom: '6px' }}>
              {purchasedRoommateCode}
            </p>
            <p style={{ fontSize: '12px', color: '#047857' }}>
              Share this code with people you want in your room. They can enter it during checkout to reserve a spot.
            </p>
          </div>
        )}

        <a
          href={`/events/${eventId}`}
          style={{ display: 'inline-block', marginTop: '20px', padding: '9px 20px', background: 'var(--sd-green)', color: '#fff', borderRadius: '7px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to event hub
        </a>
      </div>
    )
  }

  const card = (children: React.ReactNode) => (
    <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '24px' }}>
      {children}
    </div>
  )

  const navRow = (backLabel: string | null, nextLabel: string, nextDisabled: boolean, onNext: () => void) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
      {backLabel ? (
        <button onClick={prevStep} disabled={isPending}
          style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '13px', cursor: 'pointer' }}>
          ← {backLabel}
        </button>
      ) : <div />}
      <button onClick={onNext} disabled={nextDisabled || isPending}
        style={{ padding: '9px 20px', borderRadius: '7px', border: 'none', background: nextDisabled || isPending ? '#E5E7EB' : 'var(--sd-green)', color: nextDisabled || isPending ? 'var(--sd-muted)' : '#fff', fontSize: '13px', fontWeight: 600, cursor: nextDisabled || isPending ? 'not-allowed' : 'pointer' }}>
        {isPending ? 'Processing…' : nextLabel}
      </button>
    </div>
  )

  // ── Step 1: Ticket selection ──────────────────────────────────────────────────
  if (step === 'ticket') {
    return card(
      <>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '16px' }}>Select a Ticket</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ticketTypes.map(tt => {
            const selected = selectedTicketId === tt.id
            return (
              <button key={tt.id} onClick={() => {
                setSelectedTicketId(tt.id)
                // Reset all downstream state when ticket type changes
                setSelectedShiftIds([])
                setSelectedMerchIds([])
                setCodeInput('')
                setCodeError('')
                setConfirmedRoomInfo(null)
                setConfirmedRoomCode(null)
              }}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${selected ? 'var(--sd-green)' : 'var(--sd-border)'}`,
                  background: selected ? 'var(--sd-green-light)' : 'var(--sd-card)',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{tt.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: selected ? 'var(--sd-green-dark)' : 'var(--sd-text)' }}>{formatPrice(Number(tt.price))}</span>
                </div>
                {tt.description && (
                  <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: 0 }}>{tt.description}</p>
                )}
                {tt.volunteer_hours_required > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: 0 }}>
                    Requires {tt.volunteer_hours_required}h of volunteer shifts
                  </p>
                )}
                {tt.room_required_at_purchase && (
                  <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px', marginBottom: 0 }}>
                    ⚠ Room selection during checkout is not yet available — select your room after purchase.
                  </p>
                )}
              </button>
            )
          })}
        </div>
        {navRow(null, 'Next →', selectedTicketId === null, nextStep)}
      </>
    )
  }

  // ── Step 1.5: Roommate Code ───────────────────────────────────────────────────
  if (step === 'roommate_code') {
    return card(
      <>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>Roommate Code</h2>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px' }}>
          Have a Roommate Code? Enter it below to reserve a spot in your Room Lead&apos;s room. You can skip this step.
        </p>

        {/* Confirmed room card */}
        {confirmedRoomInfo ? (
          <div style={{ padding: '16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Room Confirmed
            </p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '2px' }}>
              {confirmedRoomInfo.roomName}
              {confirmedRoomInfo.roomNumber && ` · Room ${confirmedRoomInfo.roomNumber}`}
            </p>
            {confirmedRoomInfo.lodgingType && (
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '2px' }}>{confirmedRoomInfo.lodgingType}</p>
            )}
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: confirmedRoomInfo.nightlyTotal ? '6px' : '0' }}>
              Room Lead: {confirmedRoomInfo.roomLeadName}
            </p>
            {confirmedRoomInfo.nightlyTotal !== null && (
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '0' }}>
                Est. total room cost: {formatPrice(confirmedRoomInfo.nightlyTotal)} (paid directly to hotel)
              </p>
            )}
            <button
              onClick={() => { setConfirmedRoomInfo(null); setCodeInput(''); setCodeError('') }}
              style={{ marginTop: '10px', fontSize: '12px', color: '#047857', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Use a different code / skip
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
                placeholder="e.g. X3K9R7"
                maxLength={6}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: '7px', border: `1px solid ${codeError ? 'var(--sd-red)' : 'var(--sd-border)'}`,
                  fontSize: '15px', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sd-text)',
                }}
              />
              <button
                onClick={handleVerifyCode}
                disabled={!codeInput.trim() || isVerifyPending}
                style={{
                  padding: '9px 16px', borderRadius: '7px', border: 'none',
                  background: !codeInput.trim() || isVerifyPending ? '#E5E7EB' : 'var(--sd-purple)',
                  color: !codeInput.trim() || isVerifyPending ? 'var(--sd-muted)' : '#fff',
                  fontSize: '13px', fontWeight: 600, cursor: !codeInput.trim() || isVerifyPending ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isVerifyPending ? 'Checking…' : 'Verify Code'}
              </button>
            </div>
            {codeError && (
              <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{codeError}</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <button onClick={prevStep} disabled={isPending}
            style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '13px', cursor: 'pointer' }}>
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSkipCode} disabled={isPending}
              style={{ padding: '9px 16px', borderRadius: '7px', border: '1px solid var(--sd-border)', background: 'none', color: 'var(--sd-muted)', fontSize: '13px', cursor: 'pointer' }}>
              Skip
            </button>
            {confirmedRoomInfo && (
              <button onClick={handleConfirmRoom} disabled={isPending}
                style={{ padding: '9px 20px', borderRadius: '7px', border: 'none', background: 'var(--sd-green)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Confirm this room →
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // ── Step 2: Volunteer shifts ──────────────────────────────────────────────────
  if (step === 'shifts' && selectedTicket) {
    const reqHours = selectedTicket.volunteer_hours_required
    const selectedHrsDisplay = (selectedMinutes / 60).toFixed(1).replace('.0', '')
    return card(
      <>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>Select Volunteer Shifts</h2>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '16px' }}>
          Your ticket requires {reqHours} hour{reqHours !== 1 ? 's' : ''} of volunteering.
        </p>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 14px', background: hoursOk ? 'var(--sd-green-light)' : 'var(--sd-amber-light)', borderRadius: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: hoursOk ? 'var(--sd-green-dark)' : '#92400e' }}>
            {hoursOk ? '✓' : '⏳'} {selectedHrsDisplay} of {reqHours} required hour{reqHours !== 1 ? 's' : ''} selected
          </span>
        </div>

        {volunteerShifts.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No volunteer shifts are available for this event.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {volunteerShifts.map(shift => {
              const selected = selectedShiftIds.includes(shift.id)
              return (
                <button key={shift.id} onClick={() => toggleShift(shift.id)}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${selected ? 'var(--sd-green)' : 'var(--sd-border)'}`,
                    background: selected ? 'var(--sd-green-light)' : 'var(--sd-card)',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)' }}>{shift.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{formatDuration(shift.duration_minutes)}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px', marginBottom: 0 }}>
                    {formatShiftTime(shift.date_time)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
        {hasOverlap && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '10px' }}>
            Your selected shifts overlap. Please choose non-overlapping shifts.
          </p>
        )}
        {navRow('Back', 'Next →', !hoursOk || hasOverlap, nextStep)}
      </>
    )
  }

  // ── Step 3: Merchandise ───────────────────────────────────────────────────────
  if (step === 'merch') {
    return card(
      <>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>Add Merchandise</h2>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '16px' }}>Optional items available for this event.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {eligibleMerch.map(item => {
            const selected = selectedMerchIds.includes(item.id)
            return (
              <button key={item.id} onClick={() => toggleMerch(item.id)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${selected ? 'var(--sd-green)' : 'var(--sd-border)'}`,
                  background: selected ? 'var(--sd-green-light)' : 'var(--sd-card)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{item.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: selected ? 'var(--sd-green-dark)' : 'var(--sd-text)' }}>{formatPrice(Number(item.price))}</span>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px', marginBottom: 0 }}>{item.description}</p>
                  )}
                </div>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${selected ? 'var(--sd-green)' : 'var(--sd-border)'}`,
                  background: selected ? 'var(--sd-green)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>✓</span>}
                </div>
              </button>
            )
          })}
        </div>
        {navRow('Back', 'Next →', false, nextStep)}
      </>
    )
  }

  // ── Step 4: Review & confirm ──────────────────────────────────────────────────
  if (step === 'review' && selectedTicket) {
    return card(
      <>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '16px' }}>Review Your Order</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* Ticket line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--sd-border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--sd-text)' }}>🎟 {selectedTicket.name}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)' }}>{formatPrice(Number(selectedTicket.price))}</span>
          </div>

          {/* Confirmed room via code */}
          {confirmedRoomInfo && (
            <div style={{ padding: '10px 0', borderBottom: '1px solid var(--sd-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', marginBottom: '4px' }}>ROOM (VIA ROOMMATE CODE)</div>
              <div style={{ fontSize: '13px', color: 'var(--sd-text)' }}>
                {confirmedRoomInfo.roomName}
                {confirmedRoomInfo.roomNumber && ` · Room ${confirmedRoomInfo.roomNumber}`}
              </div>
            </div>
          )}

          {/* Selected shifts */}
          {selectedShiftIds.length > 0 && (
            <div style={{ padding: '10px 0', borderBottom: '1px solid var(--sd-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', marginBottom: '6px' }}>VOLUNTEER SHIFTS</div>
              {selectedShiftIds.map(id => {
                const s = volunteerShifts.find(v => v.id === id)
                return s ? (
                  <div key={id} style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '2px' }}>
                    {s.name} — {formatShiftTime(s.date_time)} ({formatDuration(s.duration_minutes)})
                  </div>
                ) : null
              })}
            </div>
          )}

          {/* Selected merch */}
          {selectedMerchItems.length > 0 && selectedMerchItems.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--sd-border)' }}>
              <span style={{ fontSize: '13px', color: 'var(--sd-text)' }}>🛍 {m.name}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)' }}>{formatPrice(Number(m.price))}</span>
            </div>
          ))}

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>Total</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: total === 0 ? 'var(--sd-green-dark)' : 'var(--sd-text)' }}>{formatPrice(total)}</span>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginBottom: '12px' }}>{error}</p>
        )}

        {navRow('Back', 'Confirm Purchase', false, handleConfirm)}
      </>
    )
  }

  return null
}
