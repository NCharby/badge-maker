-- Fix: organization_members SELECT policy was self-referencing (infinite recursion).
-- Replace with a SECURITY DEFINER function that bypasses RLS to check membership.

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
    AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.org_access_level(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT access_level FROM public.organization_members
  WHERE organization_id = p_org_id
  AND user_id = auth.uid()
  LIMIT 1
$$;

-- Drop the self-referencing policies
DROP POLICY IF EXISTS "Org members can read own org members" ON organization_members;
DROP POLICY IF EXISTS "OL/EP can insert org members" ON organization_members;
DROP POLICY IF EXISTS "OL can update org members" ON organization_members;
DROP POLICY IF EXISTS "OL can delete org members" ON organization_members;

-- Recreated policies using SECURITY DEFINER functions (no self-reference)
CREATE POLICY "Org members can read own org members"
  ON organization_members FOR SELECT
  USING (
    public.is_org_member(organization_id)
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL/EP can insert org members"
  ON organization_members FOR INSERT
  WITH CHECK (
    public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL can update org members"
  ON organization_members FOR UPDATE
  USING (
    public.org_access_level(organization_id) = 'organization_lead'
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "OL can delete org members"
  ON organization_members FOR DELETE
  USING (
    public.org_access_level(organization_id) = 'organization_lead'
    OR public.user_role() = 'system_admin'
  );

-- Also fix organizations SELECT that references organization_members
DROP POLICY IF EXISTS "Org members can read own org" ON organizations;

CREATE POLICY "Org members can read own org"
  ON organizations FOR SELECT
  USING (
    public.is_org_member(id)
  );

-- Fix OL update policy on organizations
DROP POLICY IF EXISTS "OLs can update own org" ON organizations;

CREATE POLICY "OLs can update own org"
  ON organizations FOR UPDATE
  USING (
    public.org_access_level(id) = 'organization_lead'
  );

-- Fix organization_module_access policies that reference organization_members
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

-- Fix platform_events org policies that reference organization_members directly
DROP POLICY IF EXISTS "Org OL/EP can select org events" ON platform_events;
DROP POLICY IF EXISTS "Org OL/EP can update org events" ON platform_events;
DROP POLICY IF EXISTS "Org OL/EP can insert org events" ON platform_events;
DROP POLICY IF EXISTS "Module Lead can select assigned events" ON platform_events;

CREATE POLICY "Org OL/EP can select org events"
  ON platform_events FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );

CREATE POLICY "Org OL/EP can update org events"
  ON platform_events FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );

CREATE POLICY "Org OL/EP can insert org events"
  ON platform_events FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );

CREATE POLICY "Module Lead can select assigned events"
  ON platform_events FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_module_access oma
      JOIN organization_members om ON om.id = oma.organization_member_id
      WHERE om.user_id = auth.uid()
      AND om.organization_id = platform_events.organization_id
      AND om.access_level = 'module_lead'
      AND oma.event_id = platform_events.id
    )
  );

-- Fix venues org policies
DROP POLICY IF EXISTS "Org OL/EP can select org venues" ON venues;
DROP POLICY IF EXISTS "Org OL/EP can insert org venues" ON venues;
DROP POLICY IF EXISTS "Org OL/EP can update org venues" ON venues;

CREATE POLICY "Org OL/EP can select org venues"
  ON venues FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );

CREATE POLICY "Org OL/EP can insert org venues"
  ON venues FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );

CREATE POLICY "Org OL/EP can update org venues"
  ON venues FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
