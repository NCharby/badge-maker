-- ============================================================
-- Platform Events
-- The SD Platform's Event model. Distinct from the badge-maker
-- `events` table. Links to badge-maker via shared `slug` value
-- when the Badge Module is enabled.
--
-- IMPORTANT: Never add columns to the badge-maker `events` table.
-- All platform event metadata lives here.
-- ============================================================

CREATE TABLE public.platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,         -- URL-safe; links to badge-maker events.slug when Badge Module enabled
  owner_id UUID NOT NULL REFERENCES public.platform_users(id),

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Location (use location if Venue module disabled, venue_id if enabled)
  location TEXT,
  venue_id UUID REFERENCES public.venues(id),

  -- Workflow
  -- status is one of the 7 system-fixed values or the name of a custom intermediate status.
  -- System-fixed: Draft | Published | Event Locked | Registration | Happening Now | Closed | Archived
  status TEXT NOT NULL DEFAULT 'Draft',

  -- Custom intermediate statuses between Published and Event Locked.
  -- [{ "id": UUID, "name": string, "order": integer, "description": string }]
  -- id is a stable UUID referenced by module_config and cancellation_policy.
  -- name can be renamed without breaking UUID references.
  workflow_statuses JSONB NOT NULL DEFAULT '[]',

  -- Per-module configuration.
  -- opens_at_status and closes_at_status store the UUID from workflow_statuses
  -- (or the string name for system-fixed statuses).
  -- See CLAUDE.md §5 for full module_config JSONB structure.
  module_config JSONB NOT NULL DEFAULT '{}',

  -- Cancellation policy checkpoints.
  -- { "checkpoints": [{ "status_id": UUID, "refund_percentage": integer }] }
  -- status_id references workflow_statuses entries by UUID.
  cancellation_policy JSONB NOT NULL DEFAULT '{"checkpoints": []}',

  -- Communication
  telegram_group TEXT,
  discord_server TEXT,
  social_media_links JSONB,
  group_chat_links JSONB,

  -- Key dates
  application_open_date TIMESTAMPTZ,
  tickets_open_date TIMESTAMPTZ,
  room_lock_in_date TIMESTAMPTZ,
  room_closed_date TIMESTAMPTZ,

  -- Hotel reporting
  -- If set, weekly hotel reports go to this address instead of venues.email.
  hotel_contact_email TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_platform_events_slug ON public.platform_events(slug);
CREATE INDEX idx_platform_events_owner_id ON public.platform_events(owner_id);
CREATE INDEX idx_platform_events_status ON public.platform_events(status);
CREATE INDEX idx_platform_events_venue_id ON public.platform_events(venue_id)
  WHERE venue_id IS NOT NULL;

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER update_platform_events_updated_at
  BEFORE UPDATE ON public.platform_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Users have NO direct access to platform_events.
-- Event data is served to attendees exclusively through Server Actions /
-- authenticated Route Handlers that apply their own authorization checks.
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
