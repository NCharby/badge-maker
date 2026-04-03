/**
 * Bridge between SD Platform (platform_events) and badge-maker (events) tables.
 *
 * The two systems share the `slug` field — when the Badge or Waiver module is
 * enabled for a platform event, platform_events.slug matches events.slug in the
 * badge-maker schema.
 *
 * If no badge-maker event row exists for a given slug, the bridge auto-creates
 * one using data from platform_events. This ensures EPs don't need to manually
 * seed the legacy table.
 *
 * Uses the admin client (service role) since badge-maker tables have
 * permissive public RLS anyway.
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface BadgeMakerEvent {
  id: string
  slug: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  template_id: string | null
  telegram_config: Record<string, unknown> | null
}

/**
 * Resolves a slug to the badge-maker events table row.
 * Returns null if no matching active event exists.
 */
export async function getBadgeMakerEvent(slug: string): Promise<BadgeMakerEvent | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, description, start_date, end_date, is_active, template_id, telegram_config')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as BadgeMakerEvent
}

/**
 * Ensures a badge-maker `events` row exists for the given platform event.
 * If one already exists (by slug), returns it. Otherwise creates one using
 * data from `platform_events`.
 */
async function ensureBadgeMakerEvent(
  platformEventId: string,
  slug: string,
): Promise<{ badgeMakerEventId: string } | null> {
  const admin = createAdminClient()

  // Check if it already exists
  const existing = await getBadgeMakerEvent(slug)
  if (existing) return { badgeMakerEventId: existing.id }

  // Fetch platform event data to populate the badge-maker row
  const { data: pe } = await admin
    .from('platform_events')
    .select('title, description, start_date, end_date')
    .eq('id', platformEventId)
    .single()

  if (!pe) return null

  // Create the badge-maker events row
  const { data: created, error } = await admin
    .from('events')
    .insert({
      slug,
      name: pe.title,
      description: pe.description,
      start_date: pe.start_date,
      end_date: pe.end_date,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !created) {
    // Handle race condition: another request may have created it
    const retry = await getBadgeMakerEvent(slug)
    if (retry) return { badgeMakerEventId: retry.id }

    console.error('[badge-maker-bridge] failed to create events row:', error?.message)
    return null
  }

  return { badgeMakerEventId: created.id }
}

/**
 * Given a platform event ID, resolves to the badge-maker event by slug match.
 * Auto-creates the badge-maker event row if it doesn't exist.
 * Returns null only if the platform event itself doesn't exist.
 */
export async function getBadgeMakerEventForPlatformEvent(
  platformEventId: string
): Promise<{ slug: string; badgeMakerEventId: string } | null> {
  const supabase = createAdminClient()

  const { data: platformEvent } = await supabase
    .from('platform_events')
    .select('slug')
    .eq('id', platformEventId)
    .single()

  if (!platformEvent?.slug) return null

  const result = await ensureBadgeMakerEvent(platformEventId, platformEvent.slug)
  if (!result) return null

  return {
    slug: platformEvent.slug,
    badgeMakerEventId: result.badgeMakerEventId,
  }
}
