-- ============================================================
-- Venue Enhancements
-- Adds: Event Point of Contact info, lifecycle status,
-- and notification/report configuration to venues.
-- ============================================================

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS poc_name TEXT,
  ADD COLUMN IF NOT EXISTS poc_phone TEXT,
  ADD COLUMN IF NOT EXISTS poc_email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS notification_config JSONB NOT NULL DEFAULT '{}';

-- notification_config shape:
-- {
--   "weekly_hotel_report": true,   -- send weekly hotel report to poc_email (or email fallback)
--   "room_lock_report": true        -- send room lock list to poc_email when rooms lock
-- }

COMMENT ON COLUMN public.venues.poc_name IS 'Event Point of Contact name at this venue';
COMMENT ON COLUMN public.venues.poc_phone IS 'Event Point of Contact phone at this venue';
COMMENT ON COLUMN public.venues.poc_email IS 'Event Point of Contact email; used for reports/notifications when set, otherwise falls back to venues.email';
COMMENT ON COLUMN public.venues.status IS 'active = in use; archived = removed from service; archived only if no events or only archived events reference this venue';
COMMENT ON COLUMN public.venues.notification_config IS 'Per-venue toggle for which reports/notifications are delivered to the Event POC';
