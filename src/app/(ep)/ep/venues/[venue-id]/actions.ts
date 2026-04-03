'use server'

import { revalidatePath } from 'next/cache'
import { parseCSV } from '@/lib/csv/parseCSV'
import { epVenueGuard } from '@/lib/auth/ep-guard'

async function verifyVenueAccess(venueId: string) {
  const { authorized, user, admin } = await epVenueGuard(venueId)
  if (!authorized || !user || !admin) return null
  return { userId: user.id, admin }
}

export type VenueInput = {
  name: string
  physical_address: string
  website: string
  email: string
  phone: string
  poc_name: string
  poc_phone: string
  poc_email: string
  notification_config: {
    weekly_hotel_report: boolean
    room_lock_report: boolean
  }
}

export type RoomInput = {
  number: string
  name: string
  description: string
  bed_spot_count: string
  min_occupancy: string
  room_code: string
  lodging_type: string
  bed_type: string
  has_kitchen: boolean
  location_zone: string
  room_group: string
}

function parseRoomInput(data: RoomInput): { error: string } | {
  error: null
  values: {
    number: string | null
    name: string
    description: string | null
    bed_spot_count: number
    min_occupancy: number
    room_code: string | null
    lodging_type: string | null
    bed_type: string | null
    has_kitchen: boolean
    location_zone: string | null
    room_group: string | null
  }
} {
  const name = data.name.trim()
  if (!name) return { error: 'Room name is required.' }
  const bed_spot_count = parseInt(data.bed_spot_count || '0', 10)
  if (isNaN(bed_spot_count) || bed_spot_count < 1) return { error: 'Max occupancy must be at least 1.' }
  const min_occupancy = parseInt(data.min_occupancy || '0', 10)
  if (isNaN(min_occupancy) || min_occupancy < 1) return { error: 'Min occupancy must be at least 1.' }
  if (min_occupancy > bed_spot_count) return { error: 'Min occupancy cannot exceed max occupancy.' }

  return {
    error: null,
    values: {
      number: data.number.trim() || null,
      name,
      description: data.description.trim() || null,
      bed_spot_count,
      min_occupancy,
      room_code: data.room_code.trim() || null,
      lodging_type: data.lodging_type.trim() || null,
      bed_type: data.bed_type.trim() || null,
      has_kitchen: data.has_kitchen,
      location_zone: data.location_zone.trim() || null,
      room_group: data.room_group.trim() || null,
    },
  }
}

export async function updateVenue(
  venueId: string,
  data: VenueInput,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const name = data.name.trim()
  if (!name) return { error: 'Venue name is required.' }
  const physical_address = data.physical_address.trim()
  if (!physical_address) return { error: 'Physical address is required.' }

  const { error } = await access.admin
    .from('venues')
    .update({
      name,
      physical_address,
      website: data.website.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      poc_name: data.poc_name.trim() || null,
      poc_phone: data.poc_phone.trim() || null,
      poc_email: data.poc_email.trim() || null,
      notification_config: data.notification_config,
    })
    .eq('id', venueId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  revalidatePath('/ep/venues')
  return { success: true }
}

export async function archiveVenue(
  venueId: string,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const admin = access.admin

  // Guard: only archive if no events or only archived events reference this venue
  const { data: activeEvents } = await admin
    .from('platform_events')
    .select('id')
    .eq('venue_id', venueId)
    .neq('status', 'Archived')

  if ((activeEvents?.length ?? 0) > 0) {
    return { error: 'Cannot archive a venue that has active events. Archive all associated events first.' }
  }

  const { error } = await access.admin
    .from('venues')
    .update({ status: 'archived' })
    .eq('id', venueId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  revalidatePath('/ep/venues')
  revalidatePath('/ep/dashboard')
  return { success: true }
}

export async function unarchiveVenue(
  venueId: string,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const { error } = await access.admin
    .from('venues')
    .update({ status: 'active' })
    .eq('id', venueId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  revalidatePath('/ep/venues')
  revalidatePath('/ep/dashboard')
  return { success: true }
}

export async function deleteVenue(
  venueId: string,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const admin = access.admin

  // Guard: cannot delete if any events reference this venue (any status)
  const { count } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('venue_id', venueId)

  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete a venue that is associated with events. Remove the venue from all events first.' }
  }

  // Delete all rooms first (FK constraint)
  await admin.from('rooms').delete().eq('venue_id', venueId)

  const { error } = await admin
    .from('venues')
    .delete()
    .eq('id', venueId)

  if (error) return { error: error.message }

  revalidatePath('/ep/venues')
  revalidatePath('/ep/dashboard')
  return { success: true }
}

export async function createRoom(
  venueId: string,
  data: RoomInput,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const parsed = parseRoomInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = access.admin
  const { error } = await admin
    .from('rooms')
    .insert({ venue_id: venueId, ...parsed.values })

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  return { success: true }
}

export async function updateRoom(
  roomId: string,
  venueId: string,
  data: RoomInput,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const parsed = parseRoomInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = access.admin
  const { error } = await admin
    .from('rooms')
    .update(parsed.values)
    .eq('id', roomId)
    .eq('venue_id', venueId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  return { success: true }
}

export async function deleteRoom(
  roomId: string,
  venueId: string,
): Promise<{ success: true } | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const admin = access.admin

  // Guard: no active event_attendees referencing this room
  const { count } = await admin
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)

  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete a room that has attendees assigned to it.' }
  }

  const { error } = await admin
    .from('rooms')
    .delete()
    .eq('id', roomId)
    .eq('venue_id', venueId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/venues/${venueId}`)
  return { success: true }
}

type ImportError = { row: number; message: string }
type ImportResult = { imported: number; errors: ImportError[] }

function parseDollarAmount(val: string): number | null {
  const cleaned = val.replace(/[$\s,]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseBoolField(val: string): boolean {
  return ['true', 'yes', 'y', '1'].includes(val.toLowerCase().trim())
}

export async function importRoomCSV(
  venueId: string,
  csvText: string,
): Promise<ImportResult | { error: string }> {
  const access = await verifyVenueAccess(venueId)
  if (!access) return { error: 'Access denied.' }

  const rows = parseCSV(csvText)
  if (rows.length === 0) return { imported: 0, errors: [] }

  const requiredHeaders = ['room name', 'max occupancy', 'min occupancy']
  const firstRow = rows[0]
  for (const h of requiredHeaders) {
    if (!(h in firstRow)) return { error: `Missing required column: "${h}"` }
  }

  const dayColumns = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  type RoomInsertRow = {
    venue_id: string
    number: string | null
    name: string
    description: string | null
    bed_spot_count: number
    min_occupancy: number
    room_code: string | null
    lodging_type: string | null
    bed_type: string | null
    has_kitchen: boolean
    location_zone: string | null
    room_group: string | null
    room_daily_rates: Array<{ date: string; amount: number }> | null
  }

  const toInsert: RoomInsertRow[] = []
  const errors: ImportError[] = []
  const seenNumbers = new Set<string>()

  // Pre-populate seenNumbers with room numbers already in the DB so re-uploads are caught
  const admin = access.admin
  const { data: existingRooms } = await admin
    .from('rooms')
    .select('number')
    .eq('venue_id', venueId)
    .not('number', 'is', null)
  for (const r of existingRooms ?? []) {
    if (r.number) seenNumbers.add(r.number)
  }

  rows.forEach((row, idx) => {
    const rowNum = idx + 2

    const number = row['room number']?.trim() || null
    const name = row['room name']?.trim()
    const maxOccRaw = row['max occupancy']?.trim()
    const minOccRaw = row['min occupancy']?.trim()
    const description = row['room description']?.trim() || null
    const room_code = row['room code']?.trim() || null
    const bed_type = row['bed type']?.trim() || null
    const lodging_type = row['lodging type']?.trim() || null
    const hasKitchenRaw = row['has kitchen']?.trim() || ''
    const location_zone = row['location zone']?.trim() || null
    const room_group = row['room group']?.trim() || null

    if (!name) { errors.push({ row: rowNum, message: 'Room Name is required.' }); return }

    const bed_spot_count = parseInt(maxOccRaw, 10)
    if (isNaN(bed_spot_count) || bed_spot_count < 1) {
      errors.push({ row: rowNum, message: 'Max Occupancy must be a number ≥ 1.' })
      return
    }

    const min_occupancy = parseInt(minOccRaw, 10)
    if (isNaN(min_occupancy) || min_occupancy < 1) {
      errors.push({ row: rowNum, message: 'Min Occupancy must be a number ≥ 1.' })
      return
    }

    if (min_occupancy > bed_spot_count) {
      errors.push({ row: rowNum, message: 'Min Occupancy cannot exceed Max Occupancy.' })
      return
    }

    if (number) {
      if (seenNumbers.has(number)) {
        errors.push({ row: rowNum, message: `Duplicate Room Number "${number}" — only first occurrence imported.` })
        return
      }
      seenNumbers.add(number)
    }

    // Parse day-of-week pricing columns
    const dailyRates: Array<{ date: string; amount: number }> = []
    for (const day of dayColumns) {
      const val = row[day]?.trim()
      if (val) {
        const amount = parseDollarAmount(val)
        if (amount === null) {
          errors.push({ row: rowNum, message: `Invalid dollar amount in "${day}" column: "${val}".` })
          return
        }
        dailyRates.push({ date: day, amount })
      }
    }

    toInsert.push({
      venue_id: venueId,
      number,
      name,
      description,
      bed_spot_count,
      min_occupancy,
      room_code,
      lodging_type,
      bed_type,
      has_kitchen: hasKitchenRaw ? parseBoolField(hasKitchenRaw) : false,
      location_zone,
      room_group,
      room_daily_rates: dailyRates.length > 0 ? dailyRates : null,
    })
  })

  if (toInsert.length === 0) return { imported: 0, errors }

  const { error: insertError } = await admin
    .from('rooms')
    .insert(toInsert)

  if (insertError) return { error: insertError.message }

  revalidatePath(`/ep/venues/${venueId}`)
  return { imported: toInsert.length, errors }
}
