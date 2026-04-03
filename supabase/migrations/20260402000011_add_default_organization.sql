-- Add default_organization_id to platform_users.
-- When set, the nav bar auto-selects this org on login.
-- NULL means no default (user picks each session, or "No Organization").
ALTER TABLE platform_users
  ADD COLUMN default_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
