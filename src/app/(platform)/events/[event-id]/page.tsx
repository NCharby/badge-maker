import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import type { ModuleConfig, WorkflowStatus } from '@/types/platform'
import { getModuleOpenState } from '@/lib/modules'

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
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function formatDayHeader(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
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
  badge_status: string
  volunteer_hours_required: number
  ticket_purchased_at: string | null
  order_id: string | null
  is_room_lead: boolean
  roommate_code: string | null
  user_locked: boolean
  room_lead_locked: boolean
  ticket_types: { name: string }[] | null
}

type ModuleCard = {
  key: ModuleKey
  label: string
  icon: string
  isRequired: boolean
  isComplete: boolean
  isActionRequired: boolean
  isClosed: boolean      // read-only state (past closes_at_status)
  isNotYetOpen: boolean  // module not yet available
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
  confirmedVolunteerMinutes: number = 0,
  isClosed = false,
  isNotYetOpen = false,
): ModuleCard {
  // Modules not yet open: show a locked placeholder with no CTA
  if (isNotYetOpen) {
    const { label, icon } = MODULE_META[key]
    const gray = { background: '#F3F4F6', color: '#6B7280' }
    return {
      key, label, icon,
      isRequired: config.required,
      isComplete: false,
      isActionRequired: false,
      isClosed: false,
      isNotYetOpen: true,
      statusLabel: 'Coming Soon',
      statusStyle: gray,
      iconStyle: { background: '#F3F4F6' },
      description: 'This module is not yet open.',
    }
  }
  const { label, icon } = MODULE_META[key]
  const isRequired = config.required
  const green = { background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }
  const amber = { background: 'var(--sd-amber-light)', color: '#92400e' }
  const gray  = { background: '#F3F4F6', color: '#6B7280' }
  const blue  = { background: 'var(--sd-blue-light)', color: '#1e40af' }
  const red   = { background: '#FEE2E2', color: '#DC2626' }

  const base: Omit<ModuleCard, 'key' | 'label' | 'icon' | 'isRequired' | 'isClosed'> = {
    isComplete: false,
    isActionRequired: false,
    isNotYetOpen: false,
    statusLabel: 'Incomplete',
    statusStyle: gray,
    iconStyle: { background: '#F3F4F6' },
    description: '',
  }

  // Build the card state from attendee data, then strip CTA if module is closed
  let card: ModuleCard

  switch (key) {
    case 'application': {
      const s = attendee.application_status
      const complete = s === 'Approved'
      const actionReq = !isClosed && !complete && s !== 'Declined' && s !== 'Closed'
      if (s === 'Approved') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'Approved', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Your application was reviewed and approved.', ctaLabel: 'View responses', ctaHref: `/events/${eventId}/application` }
      else if (s === 'Declined') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: false, statusLabel: 'Declined', statusStyle: red, description: 'Your application was not approved for this event.' }
      else if (s === 'Closed') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: false, statusLabel: 'Closed', statusStyle: gray, description: 'Applications are closed.' }
      else if (s === 'Incomplete') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: actionReq, statusLabel: 'Incomplete', statusStyle: gray, description: isClosed ? 'Applications are closed.' : 'Complete and submit your application to get approved.', ctaLabel: isClosed ? undefined : 'Start application →', ctaHref: isClosed ? undefined : `/events/${eventId}/application` }
      else card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: actionReq, statusLabel: 'In Review', statusStyle: amber, iconStyle: { background: 'var(--sd-amber-light)' }, description: 'Your application has been submitted and is under review.', ctaLabel: 'View application', ctaHref: `/events/${eventId}/application` }
      break
    }

    case 'ticketing': {
      const complete = attendee.ticket_status === 'Complete'
      if (complete) {
        const name = attendee.ticket_types?.[0]?.name ?? 'Ticket'
        const bought = attendee.ticket_purchased_at ? ` — purchased ${formatDate(attendee.ticket_purchased_at)}` : ''
        const orderId = attendee.order_id ? `Order #${attendee.order_id.slice(0, 8)}` : undefined
        const roommateCode = attendee.roommate_code ?? null
        const detail = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {orderId && <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{orderId}</span>}
            {roommateCode && (
              <div style={{ marginTop: '4px', padding: '8px 12px', background: '#d1fae5', borderRadius: '6px', border: '1px solid #6ee7b7' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Your Roommate Code
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#064e3b', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                  {roommateCode}
                </span>
                <span style={{ fontSize: '11px', color: '#065f46', display: 'block', marginTop: '2px' }}>
                  Share this with people you want in your room.
                </span>
              </div>
            )}
          </div>
        )
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'Complete', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: `${name}${bought}`, detail }
      } else {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: !isClosed, statusLabel: isClosed ? 'Closed' : 'Incomplete', statusStyle: isClosed ? gray : gray, description: isClosed ? 'Ticket sales are closed.' : 'Purchase your ticket to access event modules.', ctaLabel: isClosed ? undefined : 'Get your ticket →', ctaHref: isClosed ? undefined : `/events/${eventId}/ticket` }
      }
      break
    }

    case 'waiver': {
      const s = attendee.waiver_status
      if (s === 'Completed') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'Completed', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Waiver signed and verified.', ctaLabel: 'View waiver', ctaHref: `/events/${eventId}/waiver` }
      else if (s === 'Declined') card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: false, statusLabel: 'Declined', statusStyle: red, description: 'You declined to sign the waiver.' }
      else card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: !isClosed, statusLabel: isClosed ? 'Closed' : 'Incomplete', statusStyle: gray, description: isClosed ? 'Waiver signing is closed.' : 'Sign your event waiver to complete this step.', ctaLabel: isClosed ? undefined : 'Sign waiver →', ctaHref: isClosed ? undefined : `/events/${eventId}/waiver` }
      break
    }

    case 'room_selection': {
      const s = attendee.room_status
      const epLocked = s === 'Locked In' || s === 'Verified'
      const userLocked = attendee.user_locked ?? false
      const rlLocked = attendee.room_lead_locked ?? false
      const days = roomLockInDate ? daysUntil(roomLockInDate) : null
      const deadlineNote = days !== null ? (days > 0 ? `Lock-in deadline: ${formatDate(roomLockInDate!)} (${days} day${days !== 1 ? 's' : ''} remaining)` : 'Lock-in deadline has passed') : undefined
      const deadlineDetail = deadlineNote ? <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{deadlineNote}</span> : undefined

      if (epLocked || rlLocked) {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: epLocked ? s : 'Locked', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Your room is fully locked and confirmed.', ctaLabel: 'View room details →', ctaHref: `/events/${eventId}/rooms` }
      } else if (s === 'Critical Issue') {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: true, statusLabel: 'Critical Issue', statusStyle: red, description: 'There is a critical issue with your room. Contact the event promoter.', ctaHref: `/events/${eventId}/rooms` }
      } else if (s === 'Selected' && userLocked) {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: false, statusLabel: 'You Locked In', statusStyle: blue, iconStyle: { background: 'var(--sd-blue-light)' }, description: 'You are locked to your room. Awaiting Room Lead confirmation.', ctaLabel: 'View room →', ctaHref: `/events/${eventId}/rooms`, detail: deadlineDetail }
      } else if (s === 'Selected') {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: !isClosed, statusLabel: 'Selected', statusStyle: amber, iconStyle: { background: 'var(--sd-amber-light)' }, description: 'Room selected — lock in to confirm.', ctaLabel: 'View room →', ctaHref: `/events/${eventId}/rooms`, detail: deadlineDetail }
      } else if (isClosed) {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: false, statusLabel: 'Closed', statusStyle: gray, iconStyle: { background: '#F3F4F6' }, description: 'Room selection is closed.' }
      } else {
        // Not Selected — red if required, amber otherwise
        const notSelectedStyle = isRequired ? { background: 'var(--sd-red-light)', color: 'var(--sd-red)' } : amber
        const notSelectedIcon = isRequired ? { background: 'var(--sd-red-light)' } : { background: 'var(--sd-amber-light)' }
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: true, statusLabel: 'Not Selected', statusStyle: notSelectedStyle, iconStyle: notSelectedIcon, description: isRequired ? 'Room required but not yet selected.' : 'Rooms are open! Select your room before the lock-in deadline.', ctaLabel: 'Browse rooms →', ctaHref: `/events/${eventId}/rooms`, detail: deadlineDetail }
      }
      break
    }

    case 'volunteering': {
      const req = attendee.volunteer_hours_required
      if (req === 0) {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'No Requirement', statusStyle: gray, iconStyle: { background: '#F3F4F6' }, description: 'No volunteer hours required for your ticket.', ctaLabel: 'Browse shifts', ctaHref: `/events/${eventId}/volunteer` }
      } else {
        const confirmedHours = confirmedVolunteerMinutes / 60
        const complete = confirmedVolunteerMinutes >= req * 60
        const confirmedLabel = confirmedHours % 1 === 0
          ? `${confirmedHours}h`
          : `${Math.floor(confirmedHours)}h ${confirmedVolunteerMinutes % 60}m`
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: complete, isActionRequired: !complete && !isClosed, statusLabel: complete ? 'Requirement Met' : (isClosed ? 'Closed' : 'Incomplete'), statusStyle: complete ? green : (isClosed ? gray : amber), iconStyle: { background: complete ? 'var(--sd-green-light)' : (isClosed ? '#F3F4F6' : 'var(--sd-amber-light)') }, description: `${confirmedLabel} of ${req}h required hours signed up.`, ctaLabel: complete ? 'View shifts' : (isClosed ? undefined : 'Browse shifts'), ctaHref: `/events/${eventId}/volunteer` }
      }
      break
    }

    case 'schedule':
      card = { ...base, key, label, icon, isRequired: false, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'Available', statusStyle: blue, iconStyle: { background: 'var(--sd-blue-light)' }, description: 'View the event schedule and activities.', ctaLabel: 'View schedule →', ctaHref: `/events/${eventId}/schedule` }
      break

    case 'badge': {
      const badgeComplete = attendee.badge_status === 'Complete'
      if (badgeComplete) {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: true, isActionRequired: false, statusLabel: 'Complete', statusStyle: green, iconStyle: { background: 'var(--sd-green-light)' }, description: 'Your badge has been created.', ctaLabel: 'View badge', ctaHref: `/events/${eventId}/badge` }
      } else {
        card = { ...base, key, label, icon, isRequired, isClosed, isComplete: false, isActionRequired: !isClosed, statusLabel: 'Incomplete', statusStyle: gray, description: 'Create your event badge.', ctaLabel: isClosed ? undefined : 'Create badge →', ctaHref: isClosed ? undefined : `/events/${eventId}/badge` }
      }
      break
    }
  }

  return card
}

// ─── Entry-point module detection ────────────────────────────────────────────
// The "entry point" is the first required+enabled module in workflow order.
// schedule and badge never gate enrollment so they are excluded.
const ENTRY_POINT_CANDIDATES: ModuleKey[] = ['application', 'ticketing', 'waiver', 'volunteering']

function statusPosition(opensAt: string | null | undefined, workflowStatuses: WorkflowStatus[]): number {
  if (!opensAt || opensAt === 'Draft' || opensAt === 'Published') return 0
  const custom = workflowStatuses.find(s => s.id === opensAt)
  if (custom) return 2 + custom.order
  if (opensAt === 'Event Locked') return 9000
  return 9999
}

function findEntryPointModule(
  config: Record<string, ModuleConfig | undefined>,
  workflowStatuses: WorkflowStatus[],
): { key: ModuleKey; cfg: ModuleConfig } | null {
  let best: { key: ModuleKey; cfg: ModuleConfig; pos: number } | null = null
  for (const key of ENTRY_POINT_CANDIDATES) {
    const cfg = config[key]
    if (!cfg?.enabled || !cfg?.required) continue
    const pos = statusPosition(cfg.opens_at_status, workflowStatuses)
    if (!best || pos < best.pos) best = { key, cfg, pos }
  }
  return best ? { key: best.key, cfg: best.cfg } : null
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
  const adminSupabase = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch event (admin client — users have no RLS on platform_events; §3)
  const { data: event } = await adminSupabase
    .from('platform_events')
    .select('id, slug, title, description, start_date, end_date, location, status, module_config, workflow_statuses, telegram_group, telegram_chat_link, discord_server, room_lock_in_date')
    .eq('id', eventId)
    .single()

  if (!event) notFound()
  if (event.status === 'Draft') notFound()

  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const moduleConfig = (event.module_config ?? {}) as Record<string, ModuleConfig | undefined>

  // Fetch attendee record (user owns their own row) — may be null for unenrolled users
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('application_status, waiver_status, ticket_status, room_status, lock_status, badge_status, volunteer_hours_required, ticket_purchased_at, order_id, is_room_lead, roommate_code, user_locked, room_lead_locked, ticket_types(name)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  // ── Unenrolled user: show Event Detail view ──────────────────────────────
  if (!attendee) {
    const entryPoint = findEntryPointModule(moduleConfig, workflowStatuses)
    const entryPointState = entryPoint
      ? getModuleOpenState(entryPoint.cfg, event.status, workflowStatuses)
      : null
    const schCfg = moduleConfig.schedule
    const schOpen = schCfg ? getModuleOpenState(schCfg, event.status, workflowStatuses) !== 'not_yet_open' : false

    type ScheduleActivity = {
      id: string; name: string; date_time: string
      duration_minutes: number; description: string
      volunteers_requested: boolean; volunteer_count: number | null
    }
    type ScheduleDay = { key: string; label: string; items: ScheduleActivity[] }

    let scheduleDays: ScheduleDay[] = []
    if (schOpen) {
      const { data: activities } = await adminSupabase
        .from('schedule_activities')
        .select('id, name, date_time, duration_minutes, description, volunteers_requested, volunteer_count')
        .eq('event_id', eventId)
        .order('date_time', { ascending: true })
      for (const a of activities ?? []) {
        const key = getDayKey(a.date_time)
        let day = scheduleDays.find(d => d.key === key)
        if (!day) {
          day = { key, label: formatDayHeader(a.date_time), items: [] }
          scheduleDays.push(day)
        }
        day.items.push(a as ScheduleActivity)
      }
    }

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Event header */}
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: event.description ? '16px' : '0' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>{event.title}</div>
              <div style={{ fontSize: '14px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
                {event.location && <span>📍 {event.location}</span>}
                <span>🧑‍💼 Organized by Shiny Dog Productions</span>
              </div>
            </div>
            <span style={{
              fontSize: '13px', fontWeight: 500, padding: '5px 14px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0,
              background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)',
            }}>
              {event.status}
            </span>
          </div>
          {event.description && (
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)', lineHeight: 1.6, marginTop: '16px', marginBottom: 0 }}>
              {event.description}
            </p>
          )}
        </div>

        {/* CTA card */}
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          {entryPointState === 'open' ? (
            (() => {
              const ctaHref = entryPoint!.key === 'application'
                ? `/events/${eventId}/application`
                : entryPoint!.key === 'ticketing'
                  ? `/events/${eventId}/ticket`
                  : null
              const ctaLabel = entryPoint!.key === 'application'
                ? 'Apply now →'
                : entryPoint!.key === 'ticketing'
                  ? 'Get your ticket →'
                  : null
              const ctaBody = entryPoint!.key === 'application'
                ? 'Applications are open for this event.'
                : entryPoint!.key === 'ticketing'
                  ? 'Tickets are now available for this event.'
                  : 'Registration is open for this event.'
              return (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginBottom: ctaHref ? '16px' : '0' }}>
                    {ctaBody}
                  </p>
                  {ctaHref && (
                    <Link
                      href={ctaHref}
                      style={{
                        display: 'inline-block',
                        padding: '10px 22px',
                        background: 'var(--sd-green)',
                        color: '#fff',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      {ctaLabel}
                    </Link>
                  )}
                </>
              )
            })()
          ) : entryPointState === 'closed' ? (
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
              Registration for this event is now closed.
            </p>
          ) : (
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
              Stay tuned — registration for this event will be opening soon.
            </p>
          )}
        </div>

        {/* Inline schedule */}
        {schOpen && (
          <div style={{ marginTop: '24px' }}>
            <div style={{
              fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--sd-muted)', marginBottom: '14px',
            }}>
              Event Schedule
            </div>

            {scheduleDays.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
                No schedule activities have been added yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {scheduleDays.map(day => (
                  <div key={day.key}>
                    <h2 style={{
                      fontSize: '13px', fontWeight: 700, color: 'var(--sd-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      marginBottom: '12px', paddingBottom: '8px',
                      borderBottom: '1px solid var(--sd-border)',
                    }}>
                      {day.label}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {day.items.map(activity => (
                        <div key={activity.id} style={{
                          background: 'var(--sd-card)', border: '1px solid var(--sd-border)',
                          borderRadius: 'var(--sd-radius)', padding: '16px 20px',
                          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
                            {activity.name}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--sd-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: activity.description ? '10px' : 0 }}>
                            <span>{formatTime(activity.date_time)}</span>
                            <span>·</span>
                            <span>{formatDuration(activity.duration_minutes)}</span>
                            {activity.volunteers_requested && activity.volunteer_count && (
                              <>
                                <span>·</span>
                                <span style={{ color: 'var(--sd-green)', fontWeight: 600 }}>
                                  {activity.volunteer_count} volunteer{activity.volunteer_count !== 1 ? 's' : ''} needed
                                </span>
                              </>
                            )}
                          </div>
                          {activity.description && (
                            <p style={{ fontSize: '13px', color: 'var(--sd-text)', margin: 0, lineHeight: 1.5 }}>
                              {activity.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Enrolled user ────────────────────────────────────────────────────────

  // Fetch confirmed volunteer minutes for the volunteer card progress display
  const { data: confirmedSignupRows } = await supabase
    .from('user_volunteer_signups')
    .select('shift_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  let confirmedVolunteerMinutes = 0
  if (confirmedSignupRows && confirmedSignupRows.length > 0) {
    const { data: confirmedShifts } = await supabase
      .from('volunteer_shifts')
      .select('duration_minutes')
      .in('id', confirmedSignupRows.map(r => r.shift_id))
    confirmedVolunteerMinutes = (confirmedShifts ?? []).reduce((sum, s) => sum + s.duration_minutes, 0)
  }

  // Build module cards — ALL enabled modules (open, closed, and not_yet_open)
  // For room_selection: either the Basic Event Rooms key OR the Venue module key may
  // provide rooms. Both surface as the same "Room Selection" card in the hub.
  function getEffectiveCfg(key: ModuleKey): ModuleConfig | undefined {
    if (key === 'room_selection') return moduleConfig.room_selection ?? moduleConfig.venue
    return moduleConfig[key]
  }

  const cards: ModuleCard[] = MODULE_ORDER
    .filter(key => getEffectiveCfg(key)?.enabled)
    .map(key => {
      const cfg = getEffectiveCfg(key)!
      const state = getModuleOpenState(cfg, event.status, workflowStatuses)
      return buildModuleCard(
        key, cfg, attendee as unknown as AttendeeRow,
        eventId, event.room_lock_in_date ?? null, event.slug,
        confirmedVolunteerMinutes,
        state === 'closed',
        state === 'not_yet_open',
      )
    })

  // All required modules regardless of open state — used for checklist and lock gating
  const allRequiredCards = cards.filter(c => c.isRequired)
  const completedRequired = allRequiredCards.filter(c => c.isComplete).length
  const totalRequired = allRequiredCards.length
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
  // Lock section is only relevant once the event has moved past Published.
  // At Published, no modules are open and users cannot yet be active attendees.
  const showLockSection = event.status !== 'Published'

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
            {(event.telegram_chat_link || event.telegram_group || event.discord_server) && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {event.telegram_chat_link && (
                  <a
                    href={/^https?:\/\//i.test(event.telegram_chat_link) ? event.telegram_chat_link : `https://${event.telegram_chat_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '5px 12px', border: '1px solid var(--sd-border)', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--sd-text)', textDecoration: 'none', background: 'var(--sd-card)' }}
                  >
                    Telegram Group
                  </a>
                )}
                {event.telegram_group && (() => {
                  const val = event.telegram_group
                  const href = /^https?:\/\//i.test(val) ? val
                    : val.startsWith('@') ? `https://t.me/${val.slice(1)}`
                    : /^-?\d+$/.test(val) ? null
                    : `https://${val}`
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '5px 12px', border: '1px solid var(--sd-border)', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--sd-text)', textDecoration: 'none', background: 'var(--sd-card)' }}
                    >
                      Notification Channel
                    </a>
                  ) : null
                })()}
                {event.discord_server && (
                  <a
                    href={/^https?:\/\//i.test(event.discord_server) ? event.discord_server : `https://${event.discord_server}`}
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
                background: card.isNotYetOpen ? 'var(--sd-card)' : card.isActionRequired ? '#FFFBEB' : 'var(--sd-card)',
                border: `1px ${card.isRequired && !card.isNotYetOpen ? 'solid' : 'dashed'} ${card.isActionRequired ? '#FCD34D' : 'var(--sd-border)'}`,
                borderRadius: 'var(--sd-radius)',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                opacity: card.isNotYetOpen ? 0.5 : card.isClosed && !card.isComplete ? 0.75 : 1,
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', ...card.iconStyle }}>
                    {card.icon}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{card.label}</span>
                  {card.isClosed && !card.isNotYetOpen && (
                    <span style={{ fontSize: '11px', color: 'var(--sd-muted)', fontStyle: 'italic' }}>read-only</span>
                  )}
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

              {/* CTA — not shown for not_yet_open cards */}
              {!card.isNotYetOpen && (card.ctaHref ? (
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
              ) : null)}

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

      {/* Lock section — hidden until event moves past Published */}
      {showLockSection && <div
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
        {allRequiredCards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            {allRequiredCards.map(card => (
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
      </div>}
    </div>
  )
}
