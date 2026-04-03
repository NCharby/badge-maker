-- Add badge/waiver tracking columns to event_attendees
-- These enable the platform module integration with badge-maker tables
-- Rollback: ALTER TABLE event_attendees DROP COLUMN badge_status, DROP COLUMN badge_maker_badge_id, DROP COLUMN badge_maker_waiver_id;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS badge_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (badge_status IN ('Incomplete', 'Complete'));

-- Cross-reference IDs into badge-maker tables (no FK — different lifecycles)
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS badge_maker_badge_id UUID;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS badge_maker_waiver_id UUID;
