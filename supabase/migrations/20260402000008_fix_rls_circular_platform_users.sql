-- Fix: RLS policies on org tables used inline `SELECT role FROM platform_users`
-- which causes circular evaluation when called from a platform_users policy context.
-- Replace all with public.user_role() which is SECURITY DEFINER and bypasses RLS.

-- organization_members policies (already recreated in 000007, but with inline subquery)
DROP POLICY IF EXISTS "Org members can read own org members" ON organization_members;
DROP POLICY IF EXISTS "OL/EP can insert org members" ON organization_members;
DROP POLICY IF EXISTS "OL can update org members" ON organization_members;
DROP POLICY IF EXISTS "OL can delete org members" ON organization_members;

CREATE POLICY "Org members can read own org members"
  ON organization_members FOR SELECT
  USING (public.is_org_member(organization_id) OR public.user_role() = 'system_admin');

CREATE POLICY "OL/EP can insert org members"
  ON organization_members FOR INSERT
  WITH CHECK (
    public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL can update org members"
  ON organization_members FOR UPDATE
  USING (public.org_access_level(organization_id) = 'organization_lead' OR public.user_role() = 'system_admin');

CREATE POLICY "OL can delete org members"
  ON organization_members FOR DELETE
  USING (public.org_access_level(organization_id) = 'organization_lead' OR public.user_role() = 'system_admin');

-- organization_tiers (already fine, but ensure consistency)

-- organizations
DROP POLICY IF EXISTS "System admins can read all orgs" ON organizations;
CREATE POLICY "System admins can read all orgs"
  ON organizations FOR SELECT
  USING (public.user_role() = 'system_admin');

DROP POLICY IF EXISTS "System admins can insert orgs" ON organizations;
CREATE POLICY "System admins can insert orgs"
  ON organizations FOR INSERT
  WITH CHECK (public.user_role() = 'system_admin');

DROP POLICY IF EXISTS "System admins can update all orgs" ON organizations;
CREATE POLICY "System admins can update all orgs"
  ON organizations FOR UPDATE
  USING (public.user_role() = 'system_admin');

-- organization_module_access
DROP POLICY IF EXISTS "Org members can read module access" ON organization_module_access;
DROP POLICY IF EXISTS "OL/EP can insert module access" ON organization_module_access;
DROP POLICY IF EXISTS "OL/EP can delete module access" ON organization_module_access;

CREATE POLICY "Org members can read module access"
  ON organization_module_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND public.is_org_member(om.organization_id)
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL/EP can insert module access"
  ON organization_module_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND public.org_access_level(om.organization_id) IN ('organization_lead', 'event_promoter')
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL/EP can delete module access"
  ON organization_module_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.id = organization_module_access.organization_member_id
      AND public.org_access_level(om.organization_id) IN ('organization_lead', 'event_promoter')
    )
    OR public.user_role() = 'system_admin'
  );

-- organization_invitations
DROP POLICY IF EXISTS "OL/EP can read org invitations" ON organization_invitations;
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

DROP POLICY IF EXISTS "OL can insert invitations" ON organization_invitations;
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
