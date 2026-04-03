-- Module Lead per-event, per-module grants
CREATE TABLE organization_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_member_id, event_id, module_key)
);

CREATE INDEX idx_org_module_access_member ON organization_module_access(organization_member_id);
CREATE INDEX idx_org_module_access_event ON organization_module_access(event_id);
