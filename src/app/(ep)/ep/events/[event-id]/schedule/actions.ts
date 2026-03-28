'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseCSV } from '@/lib/csv/parseCSV'

export type ActivityInput = {
  name: string
  date_time: string
  duration_minutes: string
  description: string
  volunteers_requested: boolean
  volunteer_count: string
  volunteer_shift_duration_minutes: string
  volunteer_shift_date_time: string
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

function parseActivityInput(data: ActivityInput): { error: string } | {
  error: null
  values: {
    name: string
    date_time: string
    duration_minutes: number
    description: string
    volunteers_requested: boolean
    volunteer_count: number | null
    volunteer_shift_duration_minutes: number | null
    volunteer_shift_date_time: string | null
  }
} {
  const name = data.name.trim()
  if (!name) return { error: 'Name is required.' }
  if (!data.date_time) return { error: 'Date and time is required.' }
  const duration_minutes = parseInt(data.duration_minutes || '0', 10)
  if (isNaN(duration_minutes) || duration_minutes < 1) return { error: 'Duration must be at least 1 minute.' }
  const description = data.description.trim()
  if (!description) return { error: 'Description is required.' }

  let volunteer_count: number | null = null
  let volunteer_shift_duration_minutes: number | null = null
  let volunteer_shift_date_time: string | null = null

  if (data.volunteers_requested) {
    volunteer_count = parseInt(data.volunteer_count || '0', 10)
    if (isNaN(volunteer_count) || volunteer_count < 1) return { error: 'Volunteer count must be at least 1.' }
    volunteer_shift_duration_minutes = parseInt(data.volunteer_shift_duration_minutes || '0', 10)
    if (isNaN(volunteer_shift_duration_minutes) || volunteer_shift_duration_minutes < 1) {
      return { error: 'Volunteer shift duration must be at least 1 minute.' }
    }
    volunteer_shift_date_time = data.volunteer_shift_date_time || null
  }

  return {
    error: null,
    values: {
      name,
      date_time: data.date_time,
      duration_minutes,
      description,
      volunteers_requested: data.volunteers_requested,
      volunteer_count,
      volunteer_shift_duration_minutes,
      volunteer_shift_date_time,
    },
  }
}

export async function createActivity(
  eventId: string,
  data: ActivityInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseActivityInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const { data: newActivity, error } = await supabase
    .from('schedule_activities')
    .insert({ event_id: eventId, ...parsed.values })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (parsed.values.volunteers_requested && newActivity) {
    const admin = createAdminClient()
    const { error: shiftError } = await admin.from('volunteer_shifts').insert({
      event_id: eventId,
      schedule_activity_id: newActivity.id,
      name: parsed.values.name,
      date_time: parsed.values.volunteer_shift_date_time ?? parsed.values.date_time,
      duration_minutes: parsed.values.volunteer_shift_duration_minutes!,
      capacity: parsed.values.volunteer_count!,
    })
    if (shiftError) return { error: shiftError.message }
  }

  revalidatePath(`/ep/events/${eventId}/schedule`)
  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

export async function updateActivity(
  activityId: string,
  eventId: string,
  data: ActivityInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const parsed = parseActivityInput(data)
  if (parsed.error) return { error: parsed.error }
  if (!('values' in parsed)) return { error: 'Invalid input.' }

  const { error } = await supabase
    .from('schedule_activities')
    .update(parsed.values)
    .eq('id', activityId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  const admin = createAdminClient()

  if (parsed.values.volunteers_requested) {
    const { data: existing } = await admin
      .from('volunteer_shifts')
      .select('id')
      .eq('schedule_activity_id', activityId)
      .single()

    const shiftData = {
      name: parsed.values.name,
      date_time: parsed.values.volunteer_shift_date_time ?? parsed.values.date_time,
      duration_minutes: parsed.values.volunteer_shift_duration_minutes!,
      capacity: parsed.values.volunteer_count!,
    }

    if (existing) {
      const { error: shiftError } = await admin
        .from('volunteer_shifts')
        .update(shiftData)
        .eq('id', existing.id)
      if (shiftError) return { error: shiftError.message }
    } else {
      const { error: shiftError } = await admin
        .from('volunteer_shifts')
        .insert({ event_id: eventId, schedule_activity_id: activityId, ...shiftData })
      if (shiftError) return { error: shiftError.message }
    }
  } else {
    await admin
      .from('volunteer_shifts')
      .delete()
      .eq('schedule_activity_id', activityId)
  }

  revalidatePath(`/ep/events/${eventId}/schedule`)
  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

export async function deleteActivity(
  activityId: string,
  eventId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const admin = createAdminClient()
  await admin
    .from('volunteer_shifts')
    .delete()
    .eq('schedule_activity_id', activityId)
    .eq('event_id', eventId)

  const { error } = await supabase
    .from('schedule_activities')
    .delete()
    .eq('id', activityId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/ep/events/${eventId}/schedule`)
  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { success: true }
}

type ImportError = { row: number; message: string }
type ImportResult = { imported: number; errors: ImportError[] }

function parseBool(val: string): boolean {
  return ['yes', 'y', 'true', '1'].includes(val.toLowerCase().trim())
}

function isValidDate(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim()) && !isNaN(Date.parse(val.trim()))
}

function isValidTime(val: string): boolean {
  return /^\d{2}:\d{2}$/.test(val.trim())
}

export async function importScheduleCSV(
  eventId: string,
  csvText: string,
): Promise<ImportResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!await verifyEpOwnership(supabase, user.id, eventId)) return { error: 'Access denied.' }

  const rows = parseCSV(csvText)
  if (rows.length === 0) return { imported: 0, errors: [] }

  const requiredHeaders = ['activity name', 'date', 'start time', 'duration (minutes)', 'description']
  const firstRow = rows[0]
  for (const h of requiredHeaders) {
    if (!(h in firstRow)) return { error: `Missing required column: "${h}"` }
  }

  type ActivityInsertRow = {
    event_id: string
    name: string
    date_time: string
    duration_minutes: number
    description: string
    volunteers_requested: boolean
    volunteer_count: number | null
    volunteer_shift_duration_minutes: number | null
    volunteer_shift_date_time: string | null
  }

  const toInsert: ActivityInsertRow[] = []
  const errors: ImportError[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // 1-based + header row
    const name = row['activity name']?.trim()
    const date = row['date']?.trim()
    const startTime = row['start time']?.trim()
    const durationRaw = row['duration (minutes)']?.trim()
    const description = row['description']?.trim()
    const volunteersRaw = row['volunteers requested']?.trim() ?? ''
    const volunteerCountRaw = row['volunteers needed']?.trim() ?? ''
    const shiftDurRaw = row['shift duration (minutes)']?.trim() ?? ''
    const shiftTimeRaw = row['shift start time']?.trim() ?? ''

    if (!name) { errors.push({ row: rowNum, message: 'Activity Name is required.' }); return }
    if (!description) { errors.push({ row: rowNum, message: 'Description is required.' }); return }
    if (!isValidDate(date)) { errors.push({ row: rowNum, message: `Invalid Date "${date}". Use YYYY-MM-DD.` }); return }
    if (!isValidTime(startTime)) { errors.push({ row: rowNum, message: `Invalid Start Time "${startTime}". Use HH:mm (24-hr).` }); return }

    const duration = parseInt(durationRaw, 10)
    if (isNaN(duration) || duration < 1) { errors.push({ row: rowNum, message: 'Duration (minutes) must be a number ≥ 1.' }); return }

    const volunteersRequested = volunteersRaw !== '' ? parseBool(volunteersRaw) : false

    let volunteer_count: number | null = null
    let volunteer_shift_duration_minutes: number | null = null
    let volunteer_shift_date_time: string | null = null

    if (volunteersRequested) {
      volunteer_count = parseInt(volunteerCountRaw, 10)
      if (isNaN(volunteer_count) || volunteer_count < 1) {
        errors.push({ row: rowNum, message: 'Volunteers Needed must be a number ≥ 1 when Volunteers Requested = Yes.' })
        return
      }
      volunteer_shift_duration_minutes = parseInt(shiftDurRaw, 10)
      if (isNaN(volunteer_shift_duration_minutes) || volunteer_shift_duration_minutes < 1) {
        errors.push({ row: rowNum, message: 'Shift Duration (minutes) must be a number ≥ 1 when Volunteers Requested = Yes.' })
        return
      }
      const shiftTime = shiftTimeRaw && isValidTime(shiftTimeRaw) ? shiftTimeRaw : startTime
      volunteer_shift_date_time = `${date}T${shiftTime}:00`
    }

    toInsert.push({
      event_id: eventId,
      name,
      date_time: `${date}T${startTime}:00`,
      duration_minutes: duration,
      description,
      volunteers_requested: volunteersRequested,
      volunteer_count,
      volunteer_shift_duration_minutes,
      volunteer_shift_date_time,
    })
  })

  if (toInsert.length === 0) return { imported: 0, errors }

  const admin = createAdminClient()
  const { data: inserted, error: insertError } = await admin
    .from('schedule_activities')
    .insert(toInsert)
    .select('id, volunteers_requested, name, date_time, volunteer_count, volunteer_shift_duration_minutes, volunteer_shift_date_time')

  if (insertError) return { error: insertError.message }

  const volunteerShiftsToInsert = (inserted ?? [])
    .filter(a => a.volunteers_requested && a.volunteer_count != null && a.volunteer_shift_duration_minutes != null)
    .map(a => ({
      event_id: eventId,
      schedule_activity_id: a.id,
      name: a.name,
      date_time: (a.volunteer_shift_date_time ?? a.date_time) as string,
      duration_minutes: a.volunteer_shift_duration_minutes as number,
      capacity: a.volunteer_count as number,
    }))

  if (volunteerShiftsToInsert.length > 0) {
    const { error: shiftInsertError } = await admin
      .from('volunteer_shifts')
      .insert(volunteerShiftsToInsert)
    if (shiftInsertError) return { error: shiftInsertError.message }
  }

  revalidatePath(`/ep/events/${eventId}/schedule`)
  revalidatePath(`/ep/events/${eventId}/volunteer`)
  return { imported: toInsert.length, errors }
}
