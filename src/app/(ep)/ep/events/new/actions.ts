'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  title: string
  description: string
  start_date: string
  end_date: string
  location: string
  modules: ModuleInput
}): Promise<{ success: true; eventId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify EP or SA role
  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!platformUser || !['event_promoter', 'system_admin'].includes(platformUser.role)) {
    return { error: 'Access denied.' }
  }

  const title = data.title.trim()
  if (!title) return { error: 'Event title is required.' }
  if (!data.start_date) return { error: 'Start date is required.' }
  if (!data.end_date) return { error: 'End date is required.' }
  const today = new Date().toISOString().split('T')[0]
  if (data.start_date < today) return { error: 'Start date cannot be in the past.' }
  if (data.end_date < data.start_date) return { error: 'End date must be on or after start date.' }

  // Generate a unique URL-safe slug from the title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const { count: slugCount } = await supabase
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

  const { data: event, error } = await supabase
    .from('platform_events')
    .insert({
      slug,
      title,
      description: data.description.trim() || null,
      start_date: data.start_date,
      end_date: data.end_date,
      location: data.location.trim() || null,
      owner_id: user.id,
      status: 'Draft',
      module_config: moduleConfig,
      workflow_statuses: [],
    })
    .select('id')
    .single()

  if (error || !event) return { error: error?.message ?? 'Failed to create event.' }

  revalidatePath('/ep/dashboard')
  return { success: true, eventId: event.id }
}
