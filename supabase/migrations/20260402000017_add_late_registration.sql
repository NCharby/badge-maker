-- Late registration: EP can enable a "Contact Promoter" button on closing-soon events.
-- The alternate email is optional — if null, the event owner's email is used.

ALTER TABLE platform_events
  ADD COLUMN late_registration_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN late_registration_email TEXT;
