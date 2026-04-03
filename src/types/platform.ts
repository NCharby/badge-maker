/**
 * SD Platform TypeScript types.
 * These correspond to the platform tables in supabase/migrations/.
 * Badge-maker types remain in src/types/badge.ts, event.ts, telegram.ts.
 */

export type PlatformRole = 'user' | 'event_promoter' | 'system_admin'

export interface PlatformUser {
  id: string
  role: PlatformRole
  email: string
  first_name: string | null
  last_name: string | null
  telegram_handle: string | null
  telegram_verified: boolean
  date_of_birth: string // ISO date
  age_verification_status: 'unverified' | 'pending' | 'verified' | 'failed'
  age_verified_at: string | null
  preferred_scene_name: string | null
  other_scene_names: string[] | null
  phone: string | null
  address: string | null
  zip_code: string | null
  emergency_contact: string | null
  emergency_phone: string | null
  social_media: { key: string; value: string }[] | null
  profile_picture_url: string | null
  roommate_finder_hidden: boolean
  email_notifications_enabled: boolean
  telegram_notifications_enabled: boolean
  notification_preferences: Record<string, { in_platform: boolean; email: boolean; telegram: boolean }> | null
  payment_provider: 'square' | 'paypal' | null
  created_at: string
  updated_at: string
}

/** Returns the display name for a user per spec: preferred_scene_name or email-before-@ */
export function getDisplayName(user: Pick<PlatformUser, 'preferred_scene_name' | 'email'>): string {
  if (user.preferred_scene_name && user.preferred_scene_name.trim().length > 0) {
    return user.preferred_scene_name
  }
  return user.email.split('@')[0]
}

/**
 * Derives first and last name from a scene name or email.
 * Splits preferred_scene_name on first space; falls back to email-before-@.
 */
export function deriveFirstLastName(
  sceneName?: string | null,
  fallbackEmail?: string,
): { firstName: string; lastName: string } {
  const trimmed = sceneName?.trim()
  if (trimmed) {
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx > 0) {
      return { firstName: trimmed.substring(0, spaceIdx), lastName: trimmed.substring(spaceIdx + 1) }
    }
    return { firstName: trimmed, lastName: '' }
  }
  return { firstName: fallbackEmail?.split('@')[0] ?? '', lastName: '' }
}

export type ApplicationStatus =
  | 'Incomplete'
  | 'In Progress'
  | 'Needs Review'
  | 'Completed'
  | 'Approved'
  | 'Declined'
  | 'Closed'

export type WaiverStatus = 'Incomplete' | 'Completed' | 'Declined'
export type TicketStatus = 'Incomplete' | 'Complete'
export type BadgeStatus = 'Incomplete' | 'Complete'
export type RoomStatus = 'Not Selected' | 'Selected' | 'Locked In' | 'Verified' | 'Critical Issue'
export type LockStatus = 'Unlocked' | 'Ready to Lock' | 'Locked'

export type EventStatus =
  | 'Draft'
  | 'Published'
  | 'Event Locked'
  | 'Registration'
  | 'Happening Now'
  | 'Closed'
  | 'Archived'
  | string // custom intermediate statuses

export interface WorkflowStatus {
  id: string // UUID
  name: string
  order: number
  description: string
}

export interface ModuleConfig {
  enabled: boolean
  required: boolean
  opens_at_status: string | null // UUID from workflow_statuses, or system-fixed status name; null if not yet configured
  closes_at_status: string | null
  // Room locking config (room_selection / venue modules only)
  room_lead_can_lock?: boolean              // Whether Room Leads can send lock requests to occupants
  room_lead_can_lock_with_open_spots?: boolean  // Whether Room Leads can lock a room that still has open bed spots
}

export interface PlatformEvent {
  id: string
  slug: string
  owner_id: string
  organization_id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  location: string | null
  venue_id: string | null
  status: EventStatus
  workflow_statuses: WorkflowStatus[]
  module_config: {
    application?: ModuleConfig
    ticketing?: ModuleConfig
    waiver?: ModuleConfig
    venue?: ModuleConfig
    room_selection?: ModuleConfig
    volunteering?: ModuleConfig
    schedule?: ModuleConfig
    badge?: ModuleConfig
  }
  hotel_contact_email: string | null
  cancellation_policy: {
    checkpoints: { status_id: string; refund_percentage: number }[]
  } | null
  created_at: string
  updated_at: string
}

export interface RoommateFinderCard {
  room_id: string
  room_number: string
  room_name: string
  lodging_type: string | null
  min_occupancy: number
  max_occupancy: number
  open_spot_count: number
  room_lead_display_name: string // 'OPEN', 'Anonymous', or scene name
  occupants: { display_name: string }[]
}

export type LockResourceType = 'ticket' | 'shift' | 'room' | 'merchandise'

export type VolunteerSignupStatus = 'pending_checkout' | 'confirmed' | 'no_show'

export type OrderStatus = 'pending' | 'complete' | 'refunded' | 'partial_refund' | 'cancelled'
export type PaymentProvider = 'square' | 'paypal'

// ── Organization types ──────────────────────────────────────────────────────

export type OrgAccessLevel = 'organization_lead' | 'event_promoter' | 'module_lead'

export interface Organization {
  id: string
  name: string
  slug: string
  website: string | null
  logo_url: string | null
  social_media: { key: string; value: string }[] | null
  payment_provider: PaymentProvider | null
  tier_id: string
  archived: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationTier {
  id: string
  name: string
  billing_interval: 'monthly' | 'yearly' | null
  price_cents: number | null
  max_members: number | null
  max_events: number | null
  max_tickets_per_event: number | null
  allowed_modules: string[] | null
  max_attendees_per_event: number | null
  max_storage_mb: number | null
  created_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  access_level: OrgAccessLevel
  promoted_via_org: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationModuleAccess {
  id: string
  organization_member_id: string
  event_id: string
  module_key: string
  created_at: string
}

export type OrgInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface OrganizationInvitation {
  id: string
  organization_id: string
  invited_by: string
  email: string
  access_level: 'event_promoter' | 'module_lead'
  status: OrgInvitationStatus
  token: string | null
  created_at: string
  expires_at: string | null
  resolved_at: string | null
}
