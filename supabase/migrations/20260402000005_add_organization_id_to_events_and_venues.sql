-- Add organization_id to platform_events (NOT NULL — all events belong to an org)
-- NOTE: This migration will fail if existing rows lack an org. A full DB reset is
-- expected before applying this migration (per product decision).
ALTER TABLE platform_events ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_platform_events_org_id ON platform_events(organization_id);

-- Add organization_id to venues (NOT NULL — all venues belong to an org)
ALTER TABLE venues ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_venues_org_id ON venues(organization_id);
