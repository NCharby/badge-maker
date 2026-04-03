-- Waiver and badge template tables for EP configuration
-- Follows the same pattern as application_forms (UNIQUE event_id, copy-on-assign via source_template_id)
-- Rollback: DROP TABLE IF EXISTS badge_templates; DROP TABLE IF EXISTS waiver_templates;

-- ── waiver_templates ──────────────────────────────────────────────────────────

CREATE TABLE public.waiver_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE REFERENCES public.platform_events(id) ON DELETE CASCADE,
  source_template_id UUID REFERENCES public.waiver_templates(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waiver_templates_source ON public.waiver_templates(source_template_id)
  WHERE source_template_id IS NOT NULL;

ALTER TABLE public.waiver_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_waiver_templates_updated_at
  BEFORE UPDATE ON public.waiver_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: mirrors application_forms pattern
CREATE POLICY "waiver_templates: attendees and ep select" ON public.waiver_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_attendees WHERE event_id = waiver_templates.event_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_events WHERE id = waiver_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "waiver_templates: ep or sa inserts" ON public.waiver_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = waiver_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "waiver_templates: ep or sa updates" ON public.waiver_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = waiver_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "waiver_templates: ep or sa deletes" ON public.waiver_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = waiver_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

-- ── badge_templates ───────────────────────────────────────────────────────────

CREATE TABLE public.badge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE REFERENCES public.platform_events(id) ON DELETE CASCADE,
  source_template_id UUID REFERENCES public.badge_templates(id) ON DELETE SET NULL,
  name TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  background_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_badge_templates_source ON public.badge_templates(source_template_id)
  WHERE source_template_id IS NOT NULL;

ALTER TABLE public.badge_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_badge_templates_updated_at
  BEFORE UPDATE ON public.badge_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: mirrors application_forms pattern
CREATE POLICY "badge_templates: attendees and ep select" ON public.badge_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_attendees WHERE event_id = badge_templates.event_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_events WHERE id = badge_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "badge_templates: ep or sa inserts" ON public.badge_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = badge_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "badge_templates: ep or sa updates" ON public.badge_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = badge_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "badge_templates: ep or sa deletes" ON public.badge_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.platform_events WHERE id = badge_templates.event_id AND owner_id = auth.uid())
    OR public.user_role() = 'system_admin'
  );
