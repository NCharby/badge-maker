-- ============================================================
-- Application Forms and Responses
-- application_forms: one form per event (UNIQUE on event_id).
--   source_form_id tracks copy-on-assign lineage.
-- application_responses: one response record per user per event.
--
-- Copy-on-assign: when an EP selects a prior form for a new event,
-- the system copies the form row to the new event. Changes to
-- the copy do not affect the original.
-- ============================================================

CREATE TABLE public.application_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE REFERENCES public.platform_events(id) ON DELETE CASCADE,
  source_form_id UUID REFERENCES public.application_forms(id) ON DELETE SET NULL,
  title TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  -- fields structure:
  -- [
  --   {
  --     "id": "<UUID>",
  --     "type": "text" | "radio" | "checkbox" | "key_value",
  --     "label": "<string>",
  --     "options": ["<string>", ...],   -- for radio/checkbox only
  --     "required": true | false,
  --     "order": <integer>
  --   }
  -- ]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.application_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.application_forms(id),
  responses JSONB NOT NULL DEFAULT '{}',
  -- responses structure: { "<field_uuid>": <answer_value> }
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(event_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_application_forms_source ON public.application_forms(source_form_id)
  WHERE source_form_id IS NOT NULL;
CREATE INDEX idx_application_responses_event_id ON public.application_responses(event_id);
CREATE INDEX idx_application_responses_user_id ON public.application_responses(user_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE TRIGGER update_application_forms_updated_at
  BEFORE UPDATE ON public.application_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_responses_updated_at
  BEFORE UPDATE ON public.application_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_responses ENABLE ROW LEVEL SECURITY;
