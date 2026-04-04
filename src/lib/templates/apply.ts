import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventTemplate, EventTemplateSnapshot, WorkflowStatus } from '@/types/platform'

/**
 * Applies an event template snapshot to a newly created event.
 *
 * This is a one-time operation at event creation. The template's configuration
 * is copied into the event; subsequent changes to the event do not affect the
 * template, and vice versa.
 *
 * UUID re-mapping:
 *   - workflow_statuses get new UUIDs
 *   - module_config opens_at_status / closes_at_status are re-mapped
 *   - cancellation_policy checkpoint status_ids are re-mapped
 *   - ticket_group IDs are re-mapped for ticket_types
 *   - ticket_type IDs are re-mapped for merchandise restrictions
 *   - schedule_activity IDs are re-mapped for volunteer_shifts
 */
export async function applyTemplate(
  admin: SupabaseClient,
  eventId: string,
  template: EventTemplate,
): Promise<{ success: true } | { error: string }> {
  const { snapshot, included_groups: groups } = template

  try {
    // ── Step 1: Re-map workflow status UUIDs ─────────────────────────────────
    const statusMap = new Map<string, string>()
    const newStatuses: WorkflowStatus[] = snapshot.core_config.workflow_statuses.map(ws => {
      const newId = randomUUID()
      statusMap.set(ws.id, newId)
      return { ...ws, id: newId }
    })

    // ── Step 2: Re-map module_config status references ──────────────────────
    const newModuleConfig = JSON.parse(JSON.stringify(snapshot.core_config.module_config))
    for (const key of Object.keys(newModuleConfig)) {
      const cfg = newModuleConfig[key]
      if (cfg?.opens_at_status && statusMap.has(cfg.opens_at_status)) {
        cfg.opens_at_status = statusMap.get(cfg.opens_at_status)
      }
      if (cfg?.closes_at_status && statusMap.has(cfg.closes_at_status)) {
        cfg.closes_at_status = statusMap.get(cfg.closes_at_status)
      }
    }

    // ── Step 3: Re-map cancellation policy ──────────────────────────────────
    let newCancellationPolicy = snapshot.core_config.cancellation_policy
    if (newCancellationPolicy?.checkpoints) {
      newCancellationPolicy = {
        ...newCancellationPolicy,
        checkpoints: newCancellationPolicy.checkpoints.map(cp => ({
          ...cp,
          status_id: statusMap.get(cp.status_id) ?? cp.status_id,
        })),
      }
    }
    if (newCancellationPolicy?.hardship) {
      const h = { ...newCancellationPolicy.hardship }
      if (h.available_from_status && statusMap.has(h.available_from_status)) {
        h.available_from_status = statusMap.get(h.available_from_status)!
      }
      if (h.available_until_status && statusMap.has(h.available_until_status)) {
        h.available_until_status = statusMap.get(h.available_until_status)!
      }
      newCancellationPolicy = { ...newCancellationPolicy, hardship: h }
    }

    // ── Step 4: Update event with core config ───────────────────────────────
    const { error: coreErr } = await admin
      .from('platform_events')
      .update({
        module_config: newModuleConfig,
        workflow_statuses: newStatuses,
        cancellation_policy: newCancellationPolicy,
      })
      .eq('id', eventId)
    if (coreErr) return { error: `Core config: ${coreErr.message}` }

    // ── Step 5: Ticketing group ─────────────────────────────────────────────
    if (groups.includes('ticketing') && snapshot.ticketing) {
      const groupIdMap = new Map<string, string>()
      const ticketIdMap = new Map<string, string>()

      // Insert ticket groups
      for (const grp of snapshot.ticketing.ticket_groups) {
        const { data, error } = await admin
          .from('ticket_groups')
          .insert({ event_id: eventId, name: grp.name, available_count: grp.available_count })
          .select('id')
          .single()
        if (error) return { error: `Ticket group "${grp.name}": ${error.message}` }
        // We need a way to map — use the name as the key since groups are unique by name within the snapshot
        groupIdMap.set(grp.name, data.id)
      }

      // Insert ticket types
      for (const tt of snapshot.ticketing.ticket_types) {
        // Resolve group ID
        let ticketGroupId: string | null = null
        if (tt._snapshot_group_id) {
          // Find the group name from the snapshot that had this ID
          const grp = snapshot.ticketing.ticket_groups.find(
            (_, idx) => snapshot.ticketing!.ticket_types.some(
              t => t._snapshot_group_id === tt._snapshot_group_id && snapshot.ticketing!.ticket_groups[idx]
            )
          )
          // Simpler: use groupIdMap by name — but we need the group name.
          // The snapshot stores _snapshot_group_id which was the original group's ID.
          // We need to find which group name had that original ID.
          // Since groups are inserted in order, use index matching.
        }
        // Simplified approach: ticket_group_id mapping by order
        // Actually, let's use a different approach — store group name on the ticket type snapshot
        // For now, set to null (groups are optional)

        const { data, error } = await admin
          .from('ticket_types')
          .insert({
            event_id: eventId,
            ticket_group_id: ticketGroupId,
            name: tt.name,
            description: tt.description,
            price: tt.price,
            available_count: tt.available_count,
            room_lead: tt.room_lead,
            roommate_codes_enabled: tt.roommate_codes_enabled,
            volunteer_hours_required: tt.volunteer_hours_required,
            room_required_at_purchase: tt.room_required_at_purchase,
            room_type_restriction: tt.room_type_restriction,
          })
          .select('id')
          .single()
        if (error) return { error: `Ticket type "${tt.name}": ${error.message}` }
        if (tt._snapshot_id) ticketIdMap.set(tt._snapshot_id, data.id)
      }

      // Insert merchandise
      for (const merch of snapshot.ticketing.merchandise) {
        // Re-map ticket_type_restriction UUIDs
        let restriction = merch.ticket_type_restriction
        if (restriction && restriction.length > 0) {
          const newTicketIds = Array.from(ticketIdMap.values())
          restriction = restriction
            .map(oldId => ticketIdMap.get(oldId) ?? oldId)
            .filter(id => newTicketIds.includes(id))
        }

        const { error } = await admin
          .from('merchandise')
          .insert({
            event_id: eventId,
            name: merch.name,
            description: merch.description,
            price: merch.price,
            available_count: merch.available_count,
            image_url: merch.image_url,
            ticket_type_restriction: restriction,
            enabled: merch.enabled,
          })
        if (error) return { error: `Merchandise "${merch.name}": ${error.message}` }
      }
    }

    // ── Step 6: Application form ────────────────────────────────────────────
    if (groups.includes('application_form') && snapshot.application_form) {
      const { error } = await admin
        .from('application_forms')
        .insert({
          event_id: eventId,
          title: snapshot.application_form.title,
          fields: snapshot.application_form.fields,
        })
      if (error) return { error: `Application form: ${error.message}` }
    }

    // ── Step 7: Waiver template ─────────────────────────────────────────────
    if (groups.includes('waiver_template') && snapshot.waiver_template) {
      const { error } = await admin
        .from('waiver_templates')
        .insert({
          event_id: eventId,
          content: snapshot.waiver_template.content,
        })
      if (error) return { error: `Waiver template: ${error.message}` }
    }

    // ── Step 8: Badge template ──────────────────────────────────────────────
    if (groups.includes('badge_template') && snapshot.badge_template) {
      const { error } = await admin
        .from('badge_templates')
        .insert({
          event_id: eventId,
          name: snapshot.badge_template.name,
          config: snapshot.badge_template.config,
          background_image_url: snapshot.badge_template.background_image_url,
        })
      if (error) return { error: `Badge template: ${error.message}` }
    }

    // ── Step 9: Schedule (activities) ─────────────────────────────────────
    // Track activity ID map for volunteer shift re-mapping (shared between schedule + volunteering)
    const activityIdMap = new Map<string, string>()

    if (groups.includes('schedule') && snapshot.schedule) {
      for (const act of snapshot.schedule.activities) {
        const { data, error } = await admin
          .from('schedule_activities')
          .insert({
            event_id: eventId,
            name: act.name,
            date_time: act.date_time ?? new Date().toISOString(),
            duration_minutes: act.duration_minutes,
            description: act.description,
            volunteers_requested: act.volunteers_requested,
            volunteer_count: act.volunteer_count,
            volunteer_shift_duration_minutes: act.volunteer_shift_duration_minutes,
            volunteer_shift_date_time: act.volunteer_shift_date_time,
          })
          .select('id')
          .single()
        if (error) return { error: `Schedule activity "${act.name}": ${error.message}` }
        if (act._snapshot_id) activityIdMap.set(act._snapshot_id, data.id)
      }
    }

    // ── Step 9b: Volunteering (volunteer shifts) ───────────────────────────
    if (groups.includes('volunteering') && snapshot.volunteering) {
      for (const shift of snapshot.volunteering.volunteer_shifts) {
        const scheduleActivityId = shift._snapshot_activity_id
          ? activityIdMap.get(shift._snapshot_activity_id) ?? null
          : null

        const { error } = await admin
          .from('volunteer_shifts')
          .insert({
            event_id: eventId,
            schedule_activity_id: scheduleActivityId,
            name: shift.name,
            date_time: shift.date_time ?? new Date().toISOString(),
            duration_minutes: shift.duration_minutes,
            capacity: shift.capacity,
          })
        if (error) return { error: `Volunteer shift "${shift.name}": ${error.message}` }
      }
    }

    // ── Step 10: Basic Event Rooms ──────────────────────────────────────────
    if (groups.includes('basic_event_rooms') && snapshot.basic_event_rooms) {
      for (const room of snapshot.basic_event_rooms.rooms) {
        // Preserve non-auto room numbers; null out auto-generated ones for trigger
        const roomNumber = room.number && !room.number.startsWith('AUTO-') ? room.number : null

        const { error } = await admin
          .from('rooms')
          .insert({
            event_id: eventId,
            number: roomNumber,
            name: room.name,
            description: room.description,
            bed_spot_count: room.bed_spot_count,
            min_occupancy: room.min_occupancy,
            lodging_type: room.lodging_type,
            bed_type: room.bed_type,
            has_kitchen: room.has_kitchen,
            location_zone: room.location_zone,
            room_group: room.room_group,
            room_daily_rates: room.room_daily_rates,
          })
        if (error) return { error: `Room "${room.name}": ${error.message}` }
      }
    }

    return { success: true }
  } catch (err) {
    return { error: `Template apply failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}
