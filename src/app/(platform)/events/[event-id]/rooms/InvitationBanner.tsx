'use client'

import { useState, useTransition } from 'react'
import { acceptInvitation, declineInvitation } from './actions'
import type { PendingInvitation, RoomFinderCard } from './actions'

interface InvitationBannerProps {
  invitations: PendingInvitation[]
  rooms: RoomFinderCard[]
  eventId: string
}

export default function InvitationBanner({ invitations, rooms, eventId }: InvitationBannerProps) {
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<Record<string, string | null>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = invitations.filter(inv => !dismissed.has(inv.id))
  if (visible.length === 0) return null

  const handleAccept = (invitationId: string, roomId: string) => {
    startTransition(async () => {
      const result = await acceptInvitation(invitationId, eventId, roomId)
      if (result?.error) {
        setResults(prev => ({ ...prev, [invitationId]: result.error! }))
      } else {
        setDismissed(prev => new Set(prev).add(invitationId))
      }
    })
  }

  const handleDecline = (invitationId: string) => {
    startTransition(async () => {
      const result = await declineInvitation(invitationId, eventId)
      if (result?.error) {
        setResults(prev => ({ ...prev, [invitationId]: result.error! }))
      } else {
        setDismissed(prev => new Set(prev).add(invitationId))
      }
    })
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {visible.map(inv => {
        const room = rooms.find(r => r.room_id === inv.room_id)
        const roomLabel = room
          ? `${room.room_name}${room.room_number ? ` (#${room.room_number})` : ''}`
          : 'a room'

        return (
          <div
            key={inv.id}
            style={{
              background: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: 'var(--sd-radius)',
              padding: '14px 16px',
              marginBottom: '10px',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e40af' }}>
              A Room Lead has invited you to join <strong>{roomLabel}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handleAccept(inv.id, inv.room_id)}
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
                {isPending ? 'Accepting…' : 'Accept Invitation'}
              </button>
              <button
                onClick={() => handleDecline(inv.id)}
                disabled={isPending}
                style={{
                  fontSize: '13px',
                  color: '#1e40af',
                  background: 'none',
                  border: 'none',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Decline
              </button>
            </div>
            {results[inv.id] && (
              <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                {results[inv.id]}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
