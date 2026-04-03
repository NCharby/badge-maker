-- RLS policies for organization tables

-- ═══ organization_tiers ═══
-- Read-only for all authenticated users (tier info is not sensitive)
ALTER TABLE organization_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tiers"
  ON organization_tiers FOR SELECT
  USING (true);

-- Only system admins can manage tiers (via service role in practice)

-- ═══ organizations ═══
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can read their own org
CREATE POLICY "Org members can read own org"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- System admins can read all orgs
CREATE POLICY "System admins can read all orgs"
  ON organizations FOR SELECT
  USING (
    public.user_role() = 'system_admin'
  );

-- OLs can update their own org
CREATE POLICY "OLs can update own org"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND access_level = 'organization_lead'
    )
  );

-- System admins can manage all orgs
CREATE POLICY "System admins can insert orgs"
  ON organizations FOR INSERT
  WITH CHECK (
    public.user_role() = 'system_admin'
  );

CREATE POLICY "System admins can update all orgs"
  ON organizations FOR UPDATE
  USING (
    public.user_role() = 'system_admin'
  );

-- Authenticated users can insert orgs (registration creates org)
CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ═══ organization_members ═══
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Members can read members of their own org
CREATE POLICY "Org members can read own org members"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
    )
  );

-- System admins can read all members
CREATE POLICY "System admins can read all org members"
  ON organization_members FOR SELECT
  USING (
    public.user_role() = 'system_admin'
  );

-- OLs and EPs can insert members (level restrictions enforced in server actions)
CREATE POLICY "OL/EP can insert org members"
  ON organization_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.access_level IN ('organization_lead', 'event_promoter')
    )
    OR public.user_role() = 'system_admin'
  );

-- OLs can update members (level restrictions enforced in server actions)
CREATE POLICY "OL can update org members"
  ON organization_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.access_level = 'organization_lead'
    )
    OR public.user_role() = 'system_admin'
  );

-- OLs can remove members
CREATE POLICY "OL can delete org members"
  ON organization_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.access_level = 'organization_lead'
    )
    OR public.user_role() = 'system_admin'
  );

-- ═══ organization_module_access ═══
ALTER TABLE organization_module_access ENABLE ROW LEVEL SECURITY;

-- Members can read module access in their org
CREATE POLICY "Org members can read module access"
  ON organization_module_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = om.organization_id
        AND om2.user_id = auth.uid()
      )
    )
  );

-- OL/EP can manage module access
CREATE POLICY "OL/EP can insert module access"
  ON organization_module_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = om.organization_id
        AND om2.user_id = auth.uid()
        AND om2.access_level IN ('organization_lead', 'event_promoter')
      )
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL/EP can delete module access"
  ON organization_module_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = om.organization_id
        AND om2.user_id = auth.uid()
        AND om2.access_level IN ('organization_lead', 'event_promoter')
      )
    )
    OR public.user_role() = 'system_admin'
  );

-- ═══ organization_invitations ═══
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- OL/EP can read invitations for their org
CREATE POLICY "OL/EP can read org invitations"
  ON organization_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.access_level IN ('organization_lead', 'event_promoter')
    )
    OR public.user_role() = 'system_admin'
  );

-- Invitees can read their own pending invitations (by email match)
CREATE POLICY "Invitees can read own invitations"
  ON organization_invitations FOR SELECT
  USING (
    email = (SELECT email FROM platform_users WHERE id = auth.uid())
    AND status = 'pending'
  );

-- OL can insert invitations
CREATE POLICY "OL can insert invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.access_level = 'organization_lead'
    )
    OR public.user_role() = 'system_admin'
  );

-- Invitees can update their own invitations (accept/decline)
CREATE POLICY "Invitees can update own invitations"
  ON organization_invitations FOR UPDATE
  USING (
    email = (SELECT email FROM platform_users WHERE id = auth.uid())
    AND status = 'pending'
  );

-- ═══ Expanded platform_events policies for org access ═══

-- Org OL/EP can select org events
CREATE POLICY "Org OL/EP can select org events"
  ON platform_events FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = platform_events.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );

-- Org OL/EP can update org events
CREATE POLICY "Org OL/EP can update org events"
  ON platform_events FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = platform_events.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );

-- Org OL/EP can insert events for their org
CREATE POLICY "Org OL/EP can insert org events"
  ON platform_events FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = platform_events.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );

-- Module Lead can select events they have module access to
CREATE POLICY "Module Lead can select assigned events"
  ON platform_events FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organization_module_access oma ON oma.organization_member_id = om.id
      WHERE om.organization_id = platform_events.organization_id
      AND om.user_id = auth.uid()
      AND om.access_level = 'module_lead'
      AND oma.event_id = platform_events.id
    )
  );

-- ═══ Expanded venues policies for org access ═══

-- Org OL/EP can select org venues
CREATE POLICY "Org OL/EP can select org venues"
  ON venues FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = venues.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );

-- Org OL/EP can insert venues for their org
CREATE POLICY "Org OL/EP can insert org venues"
  ON venues FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = venues.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );

-- Org OL/EP can update org venues
CREATE POLICY "Org OL/EP can update org venues"
  ON venues FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = venues.organization_id
      AND user_id = auth.uid()
      AND access_level IN ('organization_lead', 'event_promoter')
    )
  );
