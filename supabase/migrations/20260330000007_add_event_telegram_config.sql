-- Add telegram_notification_config to platform_events
-- Stores per-event settings for event-specific channel notifications.
-- Shape: { [type]: { enabled: boolean, message_template: string } }
-- Types: status_transition, new_attendee_enrolled, rooms_open,
--        lock_deadline_1week, lock_deadline_48h, event_locked

ALTER TABLE public.platform_events
  ADD COLUMN IF NOT EXISTS telegram_notification_config JSONB;
