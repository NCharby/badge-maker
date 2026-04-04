-- Fix: split FOR ALL policy into separate per-operation policies (RLS-002)
-- Also adds WITH CHECK on INSERT/UPDATE (RLS-003)

DROP POLICY IF EXISTS "event_templates: sa manages all" ON event_templates;

CREATE POLICY "event_templates: sa selects"
  ON event_templates FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "event_templates: sa inserts"
  ON event_templates FOR INSERT
  WITH CHECK (public.user_role() = 'system_admin');

CREATE POLICY "event_templates: sa updates"
  ON event_templates FOR UPDATE
  USING (public.user_role() = 'system_admin')
  WITH CHECK (public.user_role() = 'system_admin');

CREATE POLICY "event_templates: sa deletes"
  ON event_templates FOR DELETE
  USING (public.user_role() = 'system_admin');
