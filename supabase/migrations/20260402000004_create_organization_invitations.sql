-- Organization invitations: pending invitations for existing and new users
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES platform_users(id),
  email TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('event_promoter', 'module_lead')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT UNIQUE,                       -- registration invitation token for non-platform users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_org_invitations_email ON organization_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_org_invitations_token ON organization_invitations(token) WHERE token IS NOT NULL AND status = 'pending';
CREATE INDEX idx_org_invitations_org ON organization_invitations(organization_id);
