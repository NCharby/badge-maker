'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TemplateGroup, EventTemplateSnapshot } from '@/types/platform'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: pu } = await supabase.from('platform_users').select('role').eq('id', user.id).single()
  return pu?.role === 'system_admin' ? user : null
}

export async function createTemplateFromEvent(data: {
  sourceEventId: string
  name: string
  description: string
  includedGroups: TemplateGroup[]
  includeScheduleTimes: boolean
}): Promise<{ success: true; templateId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  if (!data.name.trim()) return { error: 'Template name is required.' }
  if (!data.description.trim()) return { error: 'Template description is required.' }
  if (!data.includedGroups.includes('core_config')) {
    data.includedGroups = ['core_config', ...data.includedGroups]
  }

  const admin = createAdminClient()

  // Fetch source event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, module_config, workflow_statuses, cancellation_policy')
    .eq('id', data.sourceEventId)
    .single()
  if (!event) return { error: 'Source event not found.' }

  // Build snapshot
  const snapshot: EventTemplateSnapshot = {
    core_config: {
      module_config: event.module_config ?? {},
      workflow_statuses: (event.workflow_statuses ?? []) as EventTemplateSnapshot['core_config']['workflow_statuses'],
      cancellation_policy: event.cancellation_policy as EventTemplateSnapshot['core_config']['cancellation_policy'],
    },
  }

  // Ticketing
  if (data.includedGroups.includes('ticketing')) {
    const { data: groups } = await admin.from('ticket_groups').select('id, name, available_count').eq('event_id', data.sourceEventId)
    const { data: types } = await admin.from('ticket_types')
      .select('id, name, description, price, available_count, room_lead, roommate_codes_enabled, volunteer_hours_required, room_required_at_purchase, room_type_restriction, ticket_group_id')
      .eq('event_id', data.sourceEventId)
    const { data: merch } = await admin.from('merchandise')
      .select('name, description, price, available_count, image_url, ticket_type_restriction, enabled')
      .eq('event_id', data.sourceEventId)

    // Build group ID to name map for re-mapping
    const groupIdToName = new Map((groups ?? []).map(g => [g.id, g.name]))

    snapshot.ticketing = {
      ticket_groups: (groups ?? []).map(g => ({ name: g.name, available_count: g.available_count })),
      ticket_types: (types ?? []).map(t => ({
        name: t.name, description: t.description, price: t.price,
        available_count: t.available_count, room_lead: t.room_lead,
        roommate_codes_enabled: t.roommate_codes_enabled,
        volunteer_hours_required: t.volunteer_hours_required,
        room_required_at_purchase: t.room_required_at_purchase,
        room_type_restriction: t.room_type_restriction,
        _snapshot_id: t.id,
        _snapshot_group_id: t.ticket_group_id ? groupIdToName.get(t.ticket_group_id) ?? null : null,
      })),
      merchandise: (merch ?? []).map(m => ({
        name: m.name, description: m.description, price: m.price,
        available_count: m.available_count, image_url: m.image_url,
        ticket_type_restriction: m.ticket_type_restriction, enabled: m.enabled,
      })),
    }
  }

  // Application form
  if (data.includedGroups.includes('application_form')) {
    const { data: form } = await admin.from('application_forms').select('title, fields').eq('event_id', data.sourceEventId).single()
    if (form) snapshot.application_form = { title: form.title, fields: form.fields }
  }

  // Waiver template
  if (data.includedGroups.includes('waiver_template')) {
    const { data: waiver } = await admin.from('waiver_templates').select('content').eq('event_id', data.sourceEventId).single()
    if (waiver) snapshot.waiver_template = { content: waiver.content }
  }

  // Badge template
  if (data.includedGroups.includes('badge_template')) {
    const { data: badge } = await admin.from('badge_templates').select('name, config, background_image_url').eq('event_id', data.sourceEventId).single()
    if (badge) snapshot.badge_template = { name: badge.name, config: badge.config, background_image_url: badge.background_image_url }
  }

  // Schedule (activities only)
  if (data.includedGroups.includes('schedule')) {
    const { data: activities } = await admin.from('schedule_activities')
      .select('id, name, date_time, duration_minutes, description, volunteers_requested, volunteer_count, volunteer_shift_duration_minutes, volunteer_shift_date_time')
      .eq('event_id', data.sourceEventId)

    snapshot.schedule = {
      activities: (activities ?? []).map(a => ({
        name: a.name,
        date_time: data.includeScheduleTimes ? a.date_time : null,
        duration_minutes: a.duration_minutes,
        description: a.description,
        volunteers_requested: a.volunteers_requested,
        volunteer_count: a.volunteer_count,
        volunteer_shift_duration_minutes: a.volunteer_shift_duration_minutes,
        volunteer_shift_date_time: data.includeScheduleTimes ? a.volunteer_shift_date_time : null,
        _snapshot_id: a.id,
      })),
    }
  }

  // Volunteering (volunteer shifts)
  if (data.includedGroups.includes('volunteering')) {
    const { data: shifts } = await admin.from('volunteer_shifts')
      .select('name, date_time, duration_minutes, capacity, schedule_activity_id')
      .eq('event_id', data.sourceEventId)

    snapshot.volunteering = {
      volunteer_shifts: (shifts ?? []).map(s => ({
        name: s.name,
        date_time: data.includeScheduleTimes ? s.date_time : null,
        duration_minutes: s.duration_minutes,
        capacity: s.capacity,
        _snapshot_activity_id: s.schedule_activity_id,
      })),
    }
  }

  // Basic Event Rooms
  if (data.includedGroups.includes('basic_event_rooms')) {
    const { data: rooms } = await admin.from('rooms')
      .select('number, name, description, bed_spot_count, min_occupancy, lodging_type, bed_type, has_kitchen, location_zone, room_group, room_daily_rates')
      .eq('event_id', data.sourceEventId)
      .is('venue_id', null) // event-scoped only
    snapshot.basic_event_rooms = {
      rooms: (rooms ?? []).map(r => ({
        number: r.number, name: r.name, description: r.description,
        bed_spot_count: r.bed_spot_count, min_occupancy: r.min_occupancy,
        lodging_type: r.lodging_type, bed_type: r.bed_type,
        has_kitchen: r.has_kitchen ?? false, location_zone: r.location_zone,
        room_group: r.room_group, room_daily_rates: r.room_daily_rates,
      })),
    }
  }

  // Insert template
  const { data: template, error } = await admin
    .from('event_templates')
    .insert({
      name: data.name.trim(),
      description: data.description.trim(),
      source_event_id: data.sourceEventId,
      created_by: user.id,
      snapshot,
      included_groups: data.includedGroups,
      include_schedule_times: data.includeScheduleTimes,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/admin/templates')
  return { success: true, templateId: template.id }
}

export async function updateTemplate(
  templateId: string,
  data: { name?: string; description?: string }
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.description !== undefined) updates.description = data.description.trim()

  const { error } = await admin.from('event_templates').update(updates).eq('id', templateId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/templates/${templateId}`)
  revalidatePath('/admin/templates')
  return { success: true }
}

export async function deleteTemplate(
  templateId: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin.from('event_templates').delete().eq('id', templateId)
  if (error) return { error: error.message }

  revalidatePath('/admin/templates')
  return { success: true }
}
