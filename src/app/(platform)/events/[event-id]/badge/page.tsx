import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { WorkflowStatus } from '@/types/platform'
import { getModuleOpenState, type ModuleOpenState } from '@/lib/modules'
import { getBadgeMakerEventForPlatformEvent } from '@/lib/badge-maker-bridge'
import { getEventBadgeComponent } from '@/components/events'
import type { SocialMediaHandle } from '@/types/badge'
import type { BadgeTemplateConfig } from '@/types/badge-template'
import PlatformBadgeClient from './PlatformBadgeClient'

export default async function BadgePage({
  params,
}: {
  params: Promise<{ 'event-id': string }>
}) {
  const { 'event-id': eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch event
  const { data: event } = await admin
    .from('platform_events')
    .select('id, title, slug, status, module_config, workflow_statuses')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Fetch attendee record
  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('id, badge_status, badge_maker_badge_id, badge_maker_waiver_id, lock_status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!attendee) {
    redirect(`/events/${eventId}`)
  }

  // Check badge module gating
  const workflowStatuses = (event.workflow_statuses ?? []) as WorkflowStatus[]
  const moduleConfig = event.module_config as Record<
    string,
    { enabled?: boolean; required?: boolean; opens_at_status?: string | null; closes_at_status?: string | null } | undefined
  > | null
  const badgeCfg = moduleConfig?.badge
  if (!badgeCfg?.enabled) redirect(`/events/${eventId}`)

  let badgeModuleState: ModuleOpenState = 'open'
  if (badgeCfg?.enabled) {
    badgeModuleState = getModuleOpenState(
      {
        enabled: true,
        required: badgeCfg.required ?? false,
        opens_at_status: badgeCfg.opens_at_status ?? null,
        closes_at_status: badgeCfg.closes_at_status ?? null,
      },
      event.status,
      workflowStatuses,
    )
    if (badgeModuleState === 'not_yet_open') redirect(`/events/${eventId}`)
  }

  // Resolve badge-maker event linkage
  const bridge = await getBadgeMakerEventForPlatformEvent(eventId)

  // Fetch badge template for this event (data-driven rendering)
  const { data: badgeTemplate } = await admin
    .from('badge_templates')
    .select('config, background_image_url')
    .eq('event_id', eventId)
    .single()

  const templateConfig = badgeTemplate?.config
    ? (badgeTemplate.config as BadgeTemplateConfig)
    : null
  const templateBgUrl = (badgeTemplate?.background_image_url as string | null) ?? null

  // --- Completed badge: read-only view ---
  if (attendee.badge_status === 'Complete' && attendee.badge_maker_badge_id) {
    const { data: badge } = await admin
      .from('badges')
      .select('badge_name, email, original_image_url, cropped_image_url, social_media_handles, badge_data')
      .eq('id', attendee.badge_maker_badge_id)
      .single()

    // Resolve a signed URL for a private-bucket image (handles both old public URLs and new storage paths)
    const getSignedImageUrl = async (storedUrl: string | null): Promise<string | null> => {
      if (!storedUrl) return null
      const marker = '/storage/v1/object/public/badge-images/'
      const idx = storedUrl.indexOf(marker)
      // Old format: full public URL — extract the path after the bucket name
      // New format: bare storage path (e.g. "original/name-email-123.blob")
      const path = idx !== -1
        ? storedUrl.substring(idx + marker.length)
        : !storedUrl.startsWith('http') ? storedUrl : null
      if (!path) return storedUrl
      const { data } = await admin.storage
        .from('badge-images')
        .createSignedUrl(path, 60 * 60) // 1 hour
      return data?.signedUrl ?? storedUrl
    }

    if (!badge) {
      return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Link href={`/events/${eventId}`} style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>&larr; {event.title}</Link>
          </div>
          <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '24px', color: 'var(--sd-muted)', fontSize: '14px' }}>
            Your badge was created but the record could not be found. Please contact the event promoter.
          </div>
        </div>
      )
    }

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/events/${eventId}`}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            &larr; {event.title}
          </Link>
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--sd-text)',
            marginBottom: '4px',
          }}
        >
          Your Badge
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          {event.title}
        </p>

        <div
          style={{
            background: 'var(--sd-green-light)',
            border: '1px solid var(--sd-green)',
            borderRadius: 'var(--sd-radius)',
            padding: '16px 20px',
            marginBottom: '24px',
            fontSize: '14px',
            color: 'var(--sd-green-dark)',
          }}
        >
          Your badge has been created. A confirmation email has been sent.
        </div>

        {badge && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                background: 'var(--sd-card)',
                border: '1px solid var(--sd-border)',
                borderRadius: 'var(--sd-radius)',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--sd-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Badge Name
                </span>
                <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginTop: '2px' }}>
                  {badge.badge_name}
                </p>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--sd-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Email
                </span>
                <p style={{ fontSize: '14px', color: 'var(--sd-text)', marginTop: '2px' }}>
                  {badge.email}
                </p>
              </div>

              {badge.social_media_handles &&
                Array.isArray(badge.social_media_handles) &&
                badge.social_media_handles.filter(
                  (h: { platform?: string; handle?: string }) =>
                    h.platform && h.platform !== 'none' && h.handle
                ).length > 0 && (
                  <div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--sd-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Social Media
                    </span>
                    {badge.social_media_handles
                      .filter(
                        (h: { platform?: string; handle?: string }) =>
                          h.platform && h.platform !== 'none' && h.handle
                      )
                      .map((h: { platform: string; handle: string }, i: number) => (
                        <p
                          key={i}
                          style={{
                            fontSize: '14px',
                            color: 'var(--sd-text)',
                            marginTop: '2px',
                          }}
                        >
                          {h.handle}
                          <span style={{ color: 'var(--sd-muted)', marginLeft: '6px', fontSize: '12px' }}>
                            ({h.platform})
                          </span>
                        </p>
                      ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Badge preview rendered with a signed image URL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CompletedBadgePreview
            eventSlug={event.slug}
            imageUrl={await getSignedImageUrl(badge?.cropped_image_url || badge?.original_image_url || null) ?? undefined}
            badgeData={
              badge
                ? {
                    badge_name: badge.badge_name,
                    social_media_handles: (badge.social_media_handles || []) as SocialMediaHandle[],
                  }
                : undefined
            }
            badgeTemplateConfig={templateConfig}
            backgroundImageUrl={templateBgUrl}
          />
          <p
            style={{
              color: 'var(--sd-muted)',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '300px',
              marginTop: '16px',
            }}
          >
            *Simulated layout. Your actual badge will be printed slightly differently.
          </p>
        </div>
      </div>
    )
  }

  // --- Module closed and badge not complete ---
  if (badgeModuleState === 'closed') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/events/${eventId}`}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            &larr; {event.title}
          </Link>
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--sd-text)',
            marginBottom: '4px',
          }}
        >
          Badge
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          {event.title}
        </p>

        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
            Badge creation is closed for this event.
          </p>
        </div>
      </div>
    )
  }

  // --- Badge module not linked to badge-maker event ---
  if (!bridge) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/events/${eventId}`}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            &larr; {event.title}
          </Link>
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--sd-text)',
            marginBottom: '4px',
          }}
        >
          Badge
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          {event.title}
        </p>

        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>
            The badge module is not yet configured for this event. Please check back later.
          </p>
        </div>
      </div>
    )
  }

  // --- Open state: badge creation form ---
  // Fetch user profile for pre-population
  const { data: profile } = await admin
    .from('platform_users')
    .select('preferred_scene_name, email, social_media')
    .eq('id', user.id)
    .single()

  const defaultBadgeName = profile?.preferred_scene_name || ''
  const defaultEmail = profile?.email || ''

  // Map platform social_media format { key, value }[] to badge format { platform, handle }[]
  const platformSocial = (profile?.social_media as { key: string; value: string }[] | null) || []
  const platformToBadge: Record<string, string> = {
    'Twitter / X': 'x',
    'Bluesky': 'bluesky',
    'Discord': 'discord',
    'Instagram': 'instagram',
    'Fetlife': 'fetlife',
    'Recon': 'recon',
    'Telegram': 'telegram',
  }
  const defaultSocialMedia = platformSocial
    .filter(s => s.value && s.value.trim().length > 0)
    .map(s => ({
      platform: platformToBadge[s.key] || 'other',
      handle: s.value,
    }))
    .slice(0, 2)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={`/events/${eventId}`}
          style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
        >
          &larr; {event.title}
        </Link>
      </div>

      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--sd-text)',
          marginBottom: '4px',
        }}
      >
        Create Your Badge
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {event.title}
      </p>

      <PlatformBadgeClient
        eventId={eventId}
        eventSlug={event.slug}
        eventTitle={event.title}
        defaultBadgeName={defaultBadgeName}
        defaultEmail={defaultEmail}
        defaultSocialMedia={defaultSocialMedia}
        badgeTemplateConfig={templateConfig}
        backgroundImageUrl={templateBgUrl}
      />
    </div>
  )
}

/**
 * Client wrapper that renders the event-specific badge preview with
 * static badge data (completed badge view — no store interaction needed).
 * When a badge template config is provided, uses the data-driven renderer.
 */
function CompletedBadgePreview({
  eventSlug,
  imageUrl,
  badgeData,
  badgeTemplateConfig,
  backgroundImageUrl,
}: {
  eventSlug: string
  imageUrl?: string
  badgeData?: { badge_name: string; social_media_handles: SocialMediaHandle[] }
  badgeTemplateConfig?: BadgeTemplateConfig | null
  backgroundImageUrl?: string | null
}) {
  const EventBadgePreview = getEventBadgeComponent(eventSlug, badgeTemplateConfig, backgroundImageUrl)
  return <EventBadgePreview badgeData={badgeData} imageUrl={imageUrl} />
}
