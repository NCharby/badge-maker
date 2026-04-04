'use client'

import { useState } from 'react'
import Link from 'next/link'

type PastEvent = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  location: string | null
  status: string
}

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

export function BrowsePastEvents({
  events,
  enrolledEventIds,
}: {
  events: PastEvent[]
  enrolledEventIds: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const enrolledSet = new Set(enrolledEventIds)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          marginBottom: expanded ? '14px' : '0',
        }}
      >
        <span style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--sd-muted)',
        }}>
          Past Events · {events.length}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--sd-muted)', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {events.map(event => {
            const isEnrolled = enrolledSet.has(event.id)
            return (
              <div
                key={event.id}
                style={{
                  background: 'var(--sd-card)',
                  border: `1px solid ${isEnrolled ? '#9FE1CB' : 'var(--sd-border)'}`,
                  borderRadius: 'var(--sd-radius)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: 0.7,
                }}
              >
                <div style={{ height: '6px', background: 'var(--sd-muted)' }} />
                <div style={{ padding: '16px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sd-text)', lineHeight: 1.3 }}>
                      {event.title}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0, background: '#F3F4F6', color: '#6B7280' }}>
                      Closed
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                    📅 {formatDateRange(event.start_date, event.end_date)}
                  </div>
                </div>
                <div style={{
                  padding: '12px 16px', borderTop: '1px solid var(--sd-border-light)',
                  display: 'flex', justifyContent: 'flex-end', background: 'var(--sd-card2)',
                }}>
                  <Link
                    href={`/events/${event.id}`}
                    style={{
                      fontSize: '11px',
                      background: isEnrolled ? 'var(--sd-green-light)' : 'var(--sd-card)',
                      color: isEnrolled ? 'var(--sd-green-dark)' : 'var(--sd-text)',
                      border: isEnrolled ? 'none' : '1px solid var(--sd-border)',
                      padding: '4px 10px', borderRadius: '99px', fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    {isEnrolled ? 'View my event' : 'View event'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
