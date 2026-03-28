-- Migration: venue RLS tightening, room number uniqueness, notification_config default fix
-- Addresses QA bugs 3, 6, and 8 from the venue feature QA review.

-- ── Bug 3: Unique partial index on (venue_id, number) ─────────────────────────
-- Prevents two rooms in the same venue from sharing a room number.
-- Partial (WHERE number IS NOT NULL) because null numbers are system-assigned
-- AUTO-{n} values and are handled separately.

CREATE UNIQUE INDEX IF NOT EXISTS rooms_venue_number_unique
  ON public.rooms(venue_id, number)
  WHERE number IS NOT NULL;

-- ── Bug 6: Scope venues SELECT to owner EP or SA ──────────────────────────────
-- The original "shared resource pool" SELECT policy allowed any EP to read any
-- other EP's venue, including poc_name / poc_phone / poc_email added in
-- migration 18. Tighten to owner-scoped access.

DROP POLICY IF EXISTS "venues: ep and sa select all" ON public.venues;

CREATE POLICY "venues: owner ep or sa selects" ON public.venues
  FOR SELECT
  USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── Bug 8: Fix notification_config column default and backfill ─────────────────
-- Venues created before this migration have notification_config = '{}' (empty
-- object). Set an explicit default and backfill existing rows so future code
-- can safely read the keys without null-coalesce guards.

ALTER TABLE public.venues
  ALTER COLUMN notification_config
  SET DEFAULT '{"weekly_hotel_report": false, "room_lock_report": false}'::jsonb;

UPDATE public.venues
  SET notification_config = '{"weekly_hotel_report": false, "room_lock_report": false}'::jsonb
  WHERE notification_config = '{}'::jsonb;
