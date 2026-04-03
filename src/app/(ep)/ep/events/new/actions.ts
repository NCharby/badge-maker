'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkOrgAccess } from '@/lib/auth/event-access'
import { applyTemplate } from '@/lib/templates/apply'
import type { EventTemplate } from '@/types/platform'

interface ModuleInput {
  venue: boolean
  application: boolean
  waiver: boolean
  room_selection: boolean
  volunteering: boolean
  schedule: boolean
  badge: boolean
}

export async function createEvent(data: {
  organization_id: string
  title: string
  description: string
  start_date: string
  end_date: string
  venue_id?: string
  modules: ModuleInput
  template_id?: string
}): Promise<{ success: true; eventId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!data.organization_id) return { error: 'Organization is required.' }

  // Verify user has OL or EP access to this org (or is SA)
  const orgAccess = await checkOrgAccess(user.id, data.organization_id)
  if (!orgAccess.authorized) return { error: 'Access denied.' }

  // Check org is not archived
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('archived')
    .eq('id', data.organization_id)
    .single()
  if (org?.archived) return { error: 'This organization is archived. No new events can be created.' }

  const title = data.title.trim()
  if (!title) return { error: 'Event title is required.' }
  if (!data.start_date) return { error: 'Start date is required.' }
  if (!data.end_date) return { error: 'End date is required.' }
  const today = new Date().toISOString().split('T')[0]
  if (data.start_date < today) return { error: 'Start date cannot be in the past.' }
  if (data.end_date < data.start_date) return { error: 'End date must be on or after start date.' }
  if (data.modules.venue && !data.venue_id) return { error: 'A venue must be selected when the Venue module is enabled.' }

  // Generate a unique URL-safe slug from the title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const { count: slugCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('slug', baseSlug)
  const slug = (slugCount ?? 0) > 0
    ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 64)
    : baseSlug

  // Build module_config — ticketing always enabled + required
  type ModuleCfg = { enabled: boolean; required: boolean; opens_at_status: null; closes_at_status: null }
  const moduleConfig: Record<string, ModuleCfg> = {
    ticketing: { enabled: true, required: true, opens_at_status: null, closes_at_status: null },
  }
  if (data.modules.venue) {
    moduleConfig.venue = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.application) {
    moduleConfig.application = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.waiver) {
    moduleConfig.waiver = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.room_selection) {
    moduleConfig.room_selection = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.volunteering) {
    moduleConfig.volunteering = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.schedule) {
    moduleConfig.schedule = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }
  if (data.modules.badge) {
    moduleConfig.badge = { enabled: true, required: false, opens_at_status: null, closes_at_status: null }
  }

  const { data: event, error } = await admin
    .from('platform_events')
    .insert({
      slug,
      title,
      description: data.description.trim() || null,
      start_date: data.start_date,
      end_date: data.end_date,
      venue_id: data.venue_id || null,
      owner_id: user.id,
      organization_id: data.organization_id,
      status: 'Draft',
      module_config: moduleConfig,
      workflow_statuses: [],
    })
    .select('id')
    .single()

  if (error || !event) return { error: error?.message ?? 'Failed to create event.' }

  // Apply template if selected
  if (data.template_id) {
    const { data: template, error: tplErr } = await admin
      .from('event_templates')
      .select('*')
      .eq('id', data.template_id)
      .single()

    if (!tplErr && template) {
      try {
        await applyTemplate(admin, event.id, template as unknown as EventTemplate)
      } catch {
        // Template apply failed — event still exists in Draft (partial state is acceptable)
        console.error('Template apply failed for event', event.id)
      }
    }
  }

  revalidatePath('/ep/dashboard')
  return { success: true, eventId: event.id }
}
