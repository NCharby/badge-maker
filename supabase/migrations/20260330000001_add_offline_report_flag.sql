ALTER TABLE platform_events
  ADD COLUMN IF NOT EXISTS pending_offline_report BOOLEAN NOT NULL DEFAULT false;
