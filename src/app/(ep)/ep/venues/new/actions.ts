'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createVenue(data: {
  name: string
  physical_address: string
  website: string
  email: string
  phone: string
  poc_name: string
  poc_phone: string
  poc_email: string
}): Promise<{ success: true; venueId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!platformUser || !['event_promoter', 'system_admin'].includes(platformUser.role)) {
    return { error: 'Access denied.' }
  }

  const name = data.name.trim()
  if (!name) return { error: 'Venue name is required.' }
  const physical_address = data.physical_address.trim()
  if (!physical_address) return { error: 'Physical address is required.' }

  const { data: venue, error } = await supabase
    .from('venues')
    .insert({
      owner_id: user.id,
      name,
      physical_address,
      website: data.website.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      poc_name: data.poc_name.trim() || null,
      poc_phone: data.poc_phone.trim() || null,
      poc_email: data.poc_email.trim() || null,
    })
    .select('id')
    .single()

  if (error || !venue) return { error: error?.message ?? 'Failed to create venue.' }

  revalidatePath('/ep/venues')
  return { success: true, venueId: venue.id }
}
