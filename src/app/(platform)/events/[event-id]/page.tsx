import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import type { ModuleConfig } from '@/types/platform'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-US', opts)}–${e.getDate()}, ${s.getFullYear()}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Module card data ────────────────────────────────────────────────────────

type ModuleKey = 'application' | 'ticketing' | 'waiver' | 'room_selection' | 'volunteering' | 'schedule' | 'badge'

const MODULE_ORDER: ModuleKey[] = [
  'application', 'ticketing', 'waiver', 'room_selection', 'volunteering', 'schedule', 'badge',
]

const MODULE_META: Record<ModuleKey, { label: string; icon: string }> = {
  application:    { label: 'Application',    icon: '📋' },
  ticketing:      { label: 'Ticket',         icon: '🎟' },
  waiver:         { label: 'Waiver',         icon: '✍️' },
  room_selection: { label: 'Room Selection', icon: '🛏' },
  volunteering:   { label: 'Volunteering',   icon: '🙋' },
  schedule:       { label: 'Schedule',       icon: '📅' },
  badge:          { label: 'Badge',          icon: '🏷' },
}

type AttendeeRow = {
  application_status: string
  waiver_status: string
  ticket_status: string
  room_status: string
  lock_status: string
  volunteer_hours_required: number
  ticket_purchased_at: string | null
  order_id: string | null
  is_room_lead: boolean
  ticket_types: { name: string }[] | null
}

type ModuleCard = {
  key: ModuleKey
  label: string
  icon: string
  isRequired: boolean
  isComplete: boolean
  isActionRequired: boolean
  statusLabel: string
  statusStyle: { background: string; color: string }
  iconStyle: { background: string }
  description: string
  ctaLabel?: string
  ctaHref?: string
  detail?: React.ReactNode
}

function buildModuleCard(
  key: ModuleKey,
  config: ModuleConfig,
  attendee: AttendeeRow,
  eventId: string,
  roomLockInDate: string | null,
  eventSlug: string,
): ModuleCard {
  const { label, icon } = MODULE_META[key]
  const isRequired = config.required
  const green = { background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  const amber = { background: 'var(--sd-amber-light)', color: '#92400e' }
  const gray  = { background: '#F3F4F6', color: '#6B7280' }
  const blue  = { background: 'var(--sd-blue-light)', color: '#1e40af' }
  const red   = { background: '#FEE2E2', color: '#DC2626' }

  const base: Omit<ModuleCard, 'key' | 'label' | 'icon' | 'isRequired'> = {
    isComplete: false,
    isActionRequired: false,
    statusLabel: 'Incomplete',
    statusStyle: gray,
    iconStyle: { background: '#F3F4F6' },
    description: '',
  }

  switch (key) {
    case 'application': {
      const s = attendee.application_status
      const complete = s === 'Approved'
      const actionReq = !complete && s !== 'Declined' && s !== 'Closed'
      if (s === 'Approved') return { ...base, key, label, icon, isRequired, isComplete: true, isActionRequired: false, statusLabel: 'Approved', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Your application was reviewed and approved.', ctaLabel: 'View responses', ctaHref: `/events/${eventId}/application` }
      if (s === 'Declined') return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: false, statusLabel: 'Declined', statusStyle: red, description: 'Your application was not approved for this event.' }
      if (s === 'Closed') return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: false, statusLabel: 'Closed', statusStyle: gray, description: 'Applications are closed.' }
      if (s === 'Incomplete') return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: actionReq, statusLabel: 'Incomplete', statusStyle: gray, description: 'Complete and submit your application to get approved.', ctaLabel: 'Start application →', ctaHref: `/events/${eventId}/application` }
      return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: actionReq, statusLabel: 'In Review', statusStyle: amber, iconStyle: { background: 'var(--sd-amber-light)' }, description: 'Your application has been submitted and is under review.', ctaLabel: 'View application', ctaHref: `/events/${eventId}/application` }
    }

    case 'ticketing': {
      const complete = attendee.ticket_status === 'Complete'
      if (complete) {
        const name = attendee.ticket_types?.[0]?.name ?? 'Ticket'
        const bought = attendee.ticket_purchased_at ? ` — purchased ${formatDate(attendee.ticket_purchased_at)}` : ''
        const orderId = attendee.order_id ? `Order #${attendee.order_id.slice(0, 8)}` : undefined
        return { ...base, key, label, icon, isRequired, isComplete: true, isActionRequired: false, statusLabel: 'Complete', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: `${name}${bought}`, detail: orderId ? <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{orderId}</span> : undefined }
      }
      return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: true, statusLabel: 'Incomplete', statusStyle: gray, description: 'Purchase your ticket to access event modules.', ctaLabel: 'Get your ticket →', ctaHref: `/events/${eventId}/ticket` }
    }

    case 'waiver': {
      const s = attendee.waiver_status
      if (s === 'Completed') return { ...base, key, label, icon, isRequired, isComplete: true, isActionRequired: false, statusLabel: 'Completed', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Waiver signed and verified.' }
      if (s === 'Declined') return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: false, statusLabel: 'Declined', statusStyle: red, description: 'You declined to sign the waiver.' }
      return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: true, statusLabel: 'Incomplete', statusStyle: gray, description: 'Sign your event waiver to complete this step.', ctaLabel: 'Sign waiver →' /* Odoo stub — no href yet */ }
    }

    case 'room_selection': {
      const s = attendee.room_status
      const locked = s === 'Locked In' || s === 'Verified'
      if (locked) return { ...base, key, label, icon, isRequired, isComplete: true, isActionRequired: false, statusLabel: s, statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Your room selection is confirmed.', ctaLabel: 'View room details →', ctaHref: `/events/${eventId}/rooms` }
      if (s === 'Critical Issue') return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: true, statusLabel: 'Critical Issue', statusStyle: red, description: 'There is a critical issue with your room. Contact the event promoter.', ctaHref: `/events/${eventId}/rooms` }
      if (s === 'Selected') {
        const days = roomLockInDate ? daysUntil(roomLockInDate) : null
        const deadlineNote = days !== null ? (days > 0 ? `⏰ Lock-in deadline: ${formatDate(roomLockInDate!)} (${days} day${days !== 1 ? 's' : ''} remaining)` : '⏰ Lock-in deadline has passed') : undefined
        return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: true, statusLabel: 'Selected', statusStyle: amber, iconStyle: { background: 'var(--sd-amber-light)' }, description: 'Room selected — awaiting lock-in confirmation.', ctaLabel: 'View room →', ctaHref: `/events/${eventId}/rooms`, detail: deadlineNote ? <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{deadlineNote}</span> : undefined }
      }
      // Not Selected
      const days = roomLockInDate ? daysUntil(roomLockInDate) : null
      const deadlineNote = days !== null ? (days > 0 ? `⏰ Lock-in deadline: ${formatDate(roomLockInDate!)} (${days} day${days !== 1 ? 's' : ''} remaining)` : '⏰ Lock-in deadline has passed') : undefined
      return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: true, statusLabel: 'Not Selected', statusStyle: amber, iconStyle: { background: 'var(--sd-amber-light)' }, description: 'Rooms are open! Select your room before the lock-in deadline.', ctaLabel: 'Browse rooms →', ctaHref: `/events/${eventId}/rooms`, detail: deadlineNote ? <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{deadlineNote}</span> : undefined }
    }

    case 'volunteering': {
      const req = attendee.volunteer_hours_required
      const complete = req === 0
      return { ...base, key, label, icon, isRequired, isComplete: complete, isActionRequired: !complete, statusLabel: complete ? 'No Requirement' : 'Incomplete', statusStyle: complete ? gray : amber, iconStyle: { background: complete ? '#F3F4F6' : 'var(--sd-amber-light)' }, description: `0 of ${req} required hours selected.`, ctaLabel: 'Browse shifts', ctaHref: `/events/${eventId}/volunteer` }
    }

    case 'schedule':
      return { ...base, key, label, icon, isRequired: false, isComplete: true, isActionRequired: false, statusLabel: 'Available', statusStyle: blue, iconStyle: { background: 'var(--sd-blue-light)' }, description: 'View the event schedule and activities.', ctaLabel: 'View schedule →', ctaHref: `/events/${eventId}/schedule` }

    case 'badge':
      return { ...base, key, label, icon, isRequired, isComplete: false, isActionRequired: false, statusLabel: 'Incomplete', statusStyle: gray, description: 'Create your event badge.', ctaLabel: 'Create badge →', ctaHref: `/${eventSlug}/badge-creator` }
  }
}

function getLockStatusStyle(lockStatus: string): { background: string; color: string } {
  if (lockStatus === 'Locked')        return { background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  if (lockStatus === 'Ready to Lock') return { background: 'var(--sd-amber-light)', color: '#92400e' }
  return { background: '#F3F4F6', color: '#6B7280' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventAttendeePage({
  params,
}: {
  params: { 'event-id': string }
}) {
  const eventId = params['event-id']

  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch event (admin client — users have no RLS on platform_events; §3)
  const { data: event } = await adminSupabase
    .from('platform_events')
    .select('id, slug, title, start_date, end_date, location, status, module_config, telegram_group, discord_server, room_lock_in_date')
    .eq('id', eventId)
    .single()

  if (!event) notFound()
  if (event.status === 'Draft') notFound()

  // Fetch attendee record (user owns their own row)
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, waiver_status, ticket_status, room_status, lock_status, volunteer_hours_required, ticket_purchased_at, order_id, is_room_lead, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) redirect('/events/browse')

  // Build module cards for enabled modules
  const moduleConfig = (event.module_config ?? {}) as Record<string, ModuleConfig | undefined>
  const cards: ModuleCard[] = MODULE_ORDER
    .filter(key => moduleConfig[key]?.enabled)
    .map(key => buildModuleCard(key, moduleConfig[key]!, attendee as unknown as AttendeeRow, eventId, event.room_lock_in_date ?? null, event.slug))

  const requiredCards = cards.filter(c => c.isRequired)
  const completedRequired = requiredCards.filter(c => c.isComplete).length
  const totalRequired = requiredCards.length
  const progressPct = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 100
  const allRequiredComplete = completedRequired === totalRequired
  const lockStatus: string = (attendee as unknown as AttendeeRow).lock_status

  // Server action for Ready to Lock
  async function handleReadyToLock() {
    'use server'
    const supabaseSA = await createClient()
    const { data: { user: u } } = await supabaseSA.auth.getUser()
    if (!u) return
    await supabaseSA
      .from('event_attendees')
      .update({ lock_status: 'Ready to Lock' })
      .eq('event_id', eventId)
      .eq('user_id', u.id)
      .eq('lock_status', 'Unlocked')
    revalidatePath(`/events/${eventId}`)
  }

  const lockStatusStyle = getLockStatusStyle(lockStatus)
  const canLock = allRequiredComplete && lockStatus === 'Unlocked'

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px' }}>
        <Link href="/dashboard" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
          My Events
        </Link>
        {' › '}
        {event.title}
      </div>

      {/* Event header */}
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>{event.title}</div>
            <div style={{ fontSize: '14px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
              {event.location && <span>📍 {event.location}</span>}
              <span>🧑‍💼 Organized by Shiny Dog Productions</span>
            </div>
            {(event.telegram_group || event.discord_server) && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {event.telegram_group && (
                  <a
                    href={event.telegram_group}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '5px 12px', border: '1px solid var(--sd-border)', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--sd-text)', textDecoration: 'none', background: 'var(--sd-card)' }}
                  >
                    Telegram Group
                  </a>
                )}
                {event.discord_server && (
                  <a
                    href={event.discord_server}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '5px 12px', border: '1px solid var(--sd-border)', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--sd-text)', textDecoration: 'none', background: 'var(--sd-card)' }}
                  >
                    Discord
                  </a>
                )}
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              padding: '5px 14px',
              borderRadius: '99px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: 'var(--sd-green-light)',
              color: 'var(--sd-green-dark)',
            }}
          >
            {event.status}
          </span>
        </div>

        {/* Progress bar */}
        {totalRequired > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <div style={{ flex: 1, height: '8px', background: '#E5E7EB', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--sd-green)', borderRadius: '99px', transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: '13px', color: 'var(--sd-muted)', whiteSpace: 'nowrap' }}>
              {completedRequired} of {totalRequired} required step{totalRequired !== 1 ? 's' : ''} complete
            </span>
          </div>
        )}
      </div>

      {/* Module grid */}
      {cards.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {cards.map(card => (
            <div
              key={card.key}
              style={{
                background: card.isActionRequired ? '#FFFBEB' : 'var(--sd-card)',
                border: `1px ${card.isRequired ? 'solid' : 'dashed'} ${card.isActionRequired ? '#FCD34D' : 'var(--sd-border)'}`,
                borderRadius: 'var(--sd-radius)',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', ...card.iconStyle }}>
                    {card.icon}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{card.label}</span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: '99px',
                    ...card.statusStyle,
                  }}
                >
                  {card.statusLabel}
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: '13px', color: 'var(--sd-muted)', lineHeight: 1.4, marginBottom: '10px' }}>
                {card.description}
              </p>

              {/* Extra detail */}
              {card.detail && <div style={{ marginBottom: '10px' }}>{card.detail}</div>}

              {/* CTA */}
              {card.ctaHref ? (
                <Link
                  href={card.ctaHref}
                  style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    color: 'var(--sd-green)',
                    textDecoration: 'none',
                    ...(card.isActionRequired
                      ? {
                          display: 'block',
                          textAlign: 'center',
                          padding: '8px 16px',
                          background: 'var(--sd-green)',
                          color: '#fff',
                          borderRadius: '7px',
                          fontWeight: 600,
                          fontSize: '13px',
                        }
                      : {}),
                  }}
                >
                  {card.ctaLabel}
                </Link>
              ) : card.ctaLabel ? (
                <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{card.ctaLabel}</span>
              ) : null}

              {/* Optional tag */}
              {!card.isRequired && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>Optional</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lock section */}
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Attendance Lock Status</div>
            <div style={{ marginTop: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 500,
                  ...lockStatusStyle,
                }}
              >
                {lockStatus}
              </span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '16px' }}>
          {lockStatus === 'Locked'
            ? 'Your attendance is locked. No further changes can be made.'
            : lockStatus === 'Ready to Lock'
            ? 'Your "Ready to Lock" signal has been sent. The event promoter will review and lock your attendance.'
            : "When you've completed all required steps, you can signal \"Ready to Lock\" to notify the Event Promoter."}
        </p>

        {/* Requirements checklist */}
        {requiredCards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            {requiredCards.map(card => (
              <div
                key={card.key}
                style={{
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: card.isComplete ? 'var(--sd-green-dark)' : 'var(--sd-amber)',
                }}
              >
                {card.isComplete ? '✓' : '⏳'} {card.label} — {card.statusLabel}
                {!card.isComplete && ' (required)'}
              </div>
            ))}
          </div>
        )}

        {/* Ready to Lock form */}
        {lockStatus !== 'Locked' && (
          <form action={handleReadyToLock}>
            <button
              type="submit"
              disabled={!canLock}
              style={{
                padding: '10px 20px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: canLock ? 'pointer' : 'not-allowed',
                background: canLock ? 'var(--sd-green)' : '#E5E7EB',
                color: canLock ? '#fff' : 'var(--sd-muted)',
                opacity: lockStatus === 'Ready to Lock' ? 0.6 : 1,
              }}
            >
              🔒 {lockStatus === 'Ready to Lock' ? 'Signal sent' : 'Ready to Lock'}
            </button>
            {!canLock && lockStatus === 'Unlocked' && (
              <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '8px' }}>
                Complete all required steps to enable Ready to Lock.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
