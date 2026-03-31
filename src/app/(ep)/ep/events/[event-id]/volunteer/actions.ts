'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseCSV } from '@/lib/csv/parseCSV'
import { createInPlatformNotification } from '@/lib/notifications'
import { sendTelegramDM } from '@/lib/telegram/send'

export type ShiftInput = {
  name: string
  date_time: string
  duration_minutes: string
  capacity: string
}

async function verifyEpOwnership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, eventId: string) {
  const { data } = await supabase
    .from('platform_events')
    .select('id')
    .eq('id', eventId)
    .eq('owner_id', userId)
    .single()
  return !!data
}

function parseShiftInput(data: ShiftInput): { error: string } | {
  error: null
  values: { name: string; date_time: string; duration_minutes: number; capacity: number }
} {
  const name = data.name.trim()
  if (!name) return { error: 'Name is required.' }
  if (!data.date_time) return { error: 'Date and time is required.' }
  const duration_minutes = parseInt(data.duration_minutes || '0', 10)
  if (isNaN(duration_minutes) || duration_minutes < 1) return { error: 'Duration must be at least 1 minute.' }
  const capacity = parseInt(data.capacity || '0', 10)
  if (isNaN(capacity) || capacity < 1) return { error: 'Capacity must be at least 1.' }
  return { error: null, values: { name, date_time: data.date_time, duration_minutes, capacity } }
}

export async function createShift(
  eventId: string,
  data: ShiftInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseShiftInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const { error } = await supabase
    .from('volunteer_shifts')
    .insert({ event_id: eventId, ...parsed.values })

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

export async function updateShift(
  shiftId: string,
  eventId: string,
  data: ShiftInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseShiftInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const { error } = await supabase
    .from('volunteer_shifts')
    .update(parsed.values)
    .eq('id', shiftId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

export async function deleteShift(
  shiftId: string,
  eventId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  // Block deletion if confirmed signups exist
  const { count } = await supabase
    .from('user_volunteer_signups')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('status', 'confirmed')

  if ((count ?? 0) > 0) return { error: 'Cannot delete a shift with confirmed signups.' }

  const { error } = await supabase
    .from('volunteer_shifts')
    .delete()
    .eq('id', shiftId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

export async function updateSignupStatus(
  signupId: string,
  eventId: string,
  status: 'confirmed' | 'no_show',
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  // Verify the signup belongs to a shift in this event
  const { data: signup } = await admin
    .from('user_volunteer_signups')
    .select('shift_id')
    .eq('id', signupId)
    .single()

  if (!signup) return { error: 'Signup not found.' }

  const { data: shift } = await admin
    .from('volunteer_shifts')
    .select('id')
    .eq('id', signup.shift_id)
    .eq('event_id', eventId)
    .single()

  if (!shift) return { error: 'Access denied.' }

  const { error } = await admin
    .from('user_volunteer_signups')
    .update({ status })
    .eq('id', signupId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

type ImportError = { row: number; message: string }
type ImportResult = { imported: number; errors: ImportError[] }

function isValidDate(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim()) && !isNaN(Date.parse(val.trim()))
}

function isValidTime(val: string): boolean {
  return /^\d{2}:\d{2}$/.test(val.trim())
}

export async function importVolunteerCSV(
  eventId: string,
  csvText: string,
): Promise<ImportResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const rows = parseCSV(csvText)
  if (rows.length === 0) return { imported: 0, errors: [] }

  const requiredHeaders = ['shift name', 'date', 'start time', 'duration (minutes)', 'capacity']
  const firstRow = rows[0]
  for (const h of requiredHeaders) {
    if (!(h in firstRow)) return { error: `Missing required column: "${h}"` }
  }

  const toInsert: object[] = []
  const errors: ImportError[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const name = row['shift name']?.trim()
    const date = row['date']?.trim()
    const startTime = row['start time']?.trim()
    const durationRaw = row['duration (minutes)']?.trim()
    const capacityRaw = row['capacity']?.trim()

    if (!name) { errors.push({ row: rowNum, message: 'Shift Name is required.' }); return }
    if (!isValidDate(date)) { errors.push({ row: rowNum, message: `Invalid Date "${date}". Use YYYY-MM-DD.` }); return }
    if (!isValidTime(startTime)) { errors.push({ row: rowNum, message: `Invalid Start Time "${startTime}". Use HH:mm (24-hr).` }); return }

    const duration = parseInt(durationRaw, 10)
    if (isNaN(duration) || duration < 1) { errors.push({ row: rowNum, message: 'Duration (minutes) must be a number ≥ 1.' }); return }

    const capacity = parseInt(capacityRaw, 10)
    if (isNaN(capacity) || capacity < 1) { errors.push({ row: rowNum, message: 'Capacity must be a number ≥ 1.' }); return }

    toInsert.push({
      event_id: eventId,
      name,
      date_time: `${date}T${startTime}:00`,
      duration_minutes: duration,
      capacity,
    })
  })

  if (toInsert.length === 0) return { imported: 0, errors }

  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from('volunteer_shifts')
    .insert(toInsert)

  if (insertError) return { error: insertError.message }

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { imported: toInsert.length, errors }
}

export async function toggleAreaLead(
  signupId: string,
  eventId: string,
  isLead: boolean,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  // Verify the signup belongs to a shift in this event; fetch user_id for notifications
  const { data: signup } = await admin
    .from('user_volunteer_signups')
    .select('shift_id, user_id')
    .eq('id', signupId)
    .single()

  if (!signup) return { error: 'Signup not found.' }

  const { data: shift } = await admin
    .from('volunteer_shifts')
    .select('id, name')
    .eq('id', signup.shift_id)
    .eq('event_id', eventId)
    .single()

  if (!shift) return { error: 'Access denied.' }

  const { error } = await admin
    .from('user_volunteer_signups')
    .update({ area_lead_label: isLead })
    .eq('id', signupId)

  if (error) return { error: error.message }

  // Row 27 / Row 28: area lead assigned/removed → notify volunteer (in-platform + Telegram)
  const [{ data: eventRowVol }] = await Promise.all([
    admin.from('platform_events').select('title').eq('id', eventId).single(),
  ])
  const eventTitleVol = eventRowVol?.title ?? 'the event'
  const notifType = isLead ? 'area_lead_assigned' : 'area_lead_removed'
  const notifTitle = isLead ? 'Area Lead label assigned' : 'Area Lead label removed'
  const notifBody = isLead
    ? `You have been designated as Area Lead for the shift "${shift.name}" at ${eventTitleVol}.`
    : `The Area Lead label has been removed from your shift "${shift.name}" at ${eventTitleVol}.`

  void createInPlatformNotification({
    userId: signup.user_id,
    type: notifType,
    title: notifTitle,
    body: notifBody,
    actionUrl: `/events/${eventId}`,
    actionLabel: 'View Volunteer Shifts',
    eventId,
  })
  void sendTelegramDM(signup.user_id, notifBody)

  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}
