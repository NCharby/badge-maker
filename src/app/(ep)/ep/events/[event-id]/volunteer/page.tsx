import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import VolunteerManageClient from './VolunteerManageClient'
import type { ShiftWithSignups, ResolvedSignup } from './VolunteerManageClient'

function getDisplayName(user: { preferred_scene_name: string | null; email: string }): string {
  return user.preferred_scene_name?.trim() || user.email.split('@')[0]
}

export default async function EpVolunteerPage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: event } = await supabase
    .from('platform_events')
    .select('id, title')
    .eq('id', eventId)
    .eq('owner_id', user.id)
    .single()

  if (!event) notFound()

  const admin = createAdminClient()

  // Fetch shifts
  const { data: shifts } = await supabase
    .from('volunteer_shifts')
    .select('id, name, date_time, duration_minutes, capacity')
    .eq('event_id', eventId)
    .order('date_time', { ascending: true })

  const shiftList = shifts ?? []

  // Fetch signups for all shifts
  let shiftSignupMap: Record<string, ResolvedSignup[]> = {}

  if (shiftList.length > 0) {
    const shiftIds = shiftList.map(s => s.id)

    const { data: signups } = await admin
      .from('user_volunteer_signups')
      .select('id, shift_id, user_id, status, area_lead_label')
      .in('shift_id', shiftIds)

    if (signups && signups.length > 0) {
      const userIds = Array.from(new Set(signups.map(s => s.user_id)))
      const { data: users } = await admin
        .from('platform_users')
        .select('id, preferred_scene_name, email')
        .in('id', userIds)

      const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))

      shiftSignupMap = signups.reduce((acc, signup) => {
        if (!acc[signup.shift_id]) acc[signup.shift_id] = []
        const u = userMap[signup.user_id]
        acc[signup.shift_id].push({
          id: signup.id,
          user_id: signup.user_id,
          display_name: u ? getDisplayName(u) : 'Unknown',
          status: signup.status,
          area_lead_label: signup.area_lead_label,
        })
        return acc
      }, {} as Record<string, ResolvedSignup[]>)
    }
  }

  const shiftsWithSignups: ShiftWithSignups[] = shiftList.map(shift => ({
    ...shift,
    signups: shiftSignupMap[shift.id] ?? [],
  }))

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={`/ep/events/${eventId}`}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {event.title}
      </Link>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Volunteer Shifts
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      <VolunteerManageClient
        eventId={eventId}
        initialShifts={shiftsWithSignups}
      />
    </div>
  )
}
