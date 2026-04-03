-- Move emergency contact fields from waiver form to user profile
-- Rollback: ALTER TABLE platform_users DROP COLUMN emergency_contact, DROP COLUMN emergency_phone;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
