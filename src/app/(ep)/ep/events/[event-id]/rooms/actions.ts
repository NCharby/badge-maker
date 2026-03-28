'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/csv/parseCSV'

async function verifyEventOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
) {
  const { data } = await supabase
    .from('platform_events')
    .select('id')
    .eq('id', eventId)
    .eq('owner_id', userId)
    .single()
  return !!data
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

export async function createEventRoom(
  eventId: string,
  data: RoomInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEventOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseRoomInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('rooms')
    .insert({ event_id: eventId, venue_id: null, ...parsed.values })

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/rooms`)
  return { success: true }
}

export async function updateEventRoom(
  roomId: string,
  eventId: string,
  data: RoomInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEventOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseRoomInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('rooms')
    .update(parsed.values)
    .eq('id', roomId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/rooms`)
  return { success: true }
}

export async function deleteEventRoom(
  roomId: string,
  eventId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEventOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const admin = createAdminClient()

  // Guard: no attendees assigned to this room
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
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/rooms`)
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

export async function importEventRoomCSV(
  eventId: string,
  csvText: string,
): Promise<ImportResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEventOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const rows = parseCSV(csvText)
  if (rows.length === 0) return { imported: 0, errors: [] }

  const requiredHeaders = ['room name', 'max occupancy', 'min occupancy']
  const firstRow = rows[0]
  for (const h of requiredHeaders) {
    if (!(h in firstRow)) return { error: `Missing required column: "${h}"` }
  }

  const dayColumns = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  type RoomInsertRow = {
    event_id: string
    venue_id: null
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

  // Pre-populate seenNumbers with room numbers already in the DB for this event
  const admin = createAdminClient()
  const { data: existingRooms } = await admin
    .from('rooms')
    .select('number')
    .eq('event_id', eventId)
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
      event_id: eventId,
      venue_id: null,
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

  revalidatePath(`/ep/events/${eventId}/rooms`)
  return { imported: toInsert.length, errors }
}
