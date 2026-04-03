-- Event templates: reusable event configuration snapshots
CREATE TABLE event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  source_event_id UUID REFERENCES platform_events(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES platform_users(id),
  snapshot JSONB NOT NULL,
  included_groups TEXT[] NOT NULL,
  include_schedule_times BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_templates_created_by ON event_templates(created_by);
CREATE INDEX idx_event_templates_source ON event_templates(source_event_id) WHERE source_event_id IS NOT NULL;

CREATE TRIGGER update_event_templates_updated_at
  BEFORE UPDATE ON event_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Option C — simple role gate, admin client for cross-entity reads
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_templates: sa manages all"
  ON event_templates FOR ALL
  USING (public.user_role() = 'system_admin');

-- EPs read templates via admin client in Server Actions (event creation page)
-- No direct EP RLS needed
CREATE POLICY "event_templates: ep reads"
  ON event_templates FOR SELECT
  USING (public.user_role() = 'event_promoter');
