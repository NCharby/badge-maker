-- Module Lead access is now org-wide, not per-event.
-- The EP configures which modules a ML can manage once; at runtime,
-- the effective access = (org-level grants) ∩ (event-enabled modules).

-- Drop old per-event indexes and constraint
DROP INDEX IF EXISTS idx_org_module_access_event;

-- Recreate table without event_id
-- (DROP + CREATE is safe here because this is pre-production; no data to migrate)
DROP TABLE IF EXISTS organization_module_access;

CREATE TABLE organization_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_member_id, module_key)
);

CREATE INDEX idx_org_module_access_member ON organization_module_access(organization_member_id);
