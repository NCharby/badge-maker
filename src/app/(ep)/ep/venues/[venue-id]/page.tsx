import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import VenueDetailClient from './VenueDetailClient'
import { epVenueGuard } from '@/lib/auth/ep-guard'

export default async function VenueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'venue-id': string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { 'venue-id': venueId } = await params
  const { returnTo } = await searchParams

  const { authorized } = await epVenueGuard(venueId)
  if (!authorized) notFound()

  const admin = createAdminClient()

  const { data: venue } = await admin
    .from('venues')
    .select('id, name, physical_address, website, email, phone, poc_name, poc_phone, poc_email, status, notification_config')
    .eq('id', venueId)
    .single()

  if (!venue) notFound()
  const { data: rooms } = await admin
    .from('rooms')
    .select('id, number, name, description, bed_spot_count, min_occupancy, room_code, lodging_type, bed_type, has_kitchen, location_zone, room_group')
    .eq('venue_id', venueId)
    .order('name', { ascending: true })

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href={returnTo ?? '/ep/venues'}
        style={{ fontSize: '13px', color: 'var(--sd-purple)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← {returnTo ? 'Back' : 'Venues'}
      </Link>
      <VenueDetailClient
        venueId={venueId}
        initialVenue={venue}
        initialRooms={rooms ?? []}
      />
    </div>
  )
}
