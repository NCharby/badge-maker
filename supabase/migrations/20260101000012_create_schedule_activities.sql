-- ============================================================
-- Schedule Activities
-- Activities on the event schedule. Optional volunteer
-- integration fields enable the Schedule → Volunteer module
-- connection: activities with volunteers_requested = true
-- can generate volunteer_shifts in migration 20260101000013.
-- ============================================================

CREATE TABLE public.schedule_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT NOT NULL,

  -- Volunteer integration (all optional; required together if volunteers_requested = true)
  volunteers_requested BOOLEAN NOT NULL DEFAULT false,
  volunteer_count INTEGER,                      -- number of volunteers requested
  volunteer_shift_duration_minutes INTEGER,     -- length of volunteer shift
  volunteer_shift_date_time TIMESTAMPTZ,        -- start time of volunteer shift

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_schedule_activities_event_id ON public.schedule_activities(event_id);
CREATE INDEX idx_schedule_activities_date_time ON public.schedule_activities(event_id, date_time);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;
